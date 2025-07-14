define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Проверка доступности AmoCRM API
    this.checkAMOCRM = function () {
      try {
        if (
          typeof AmoCRM === "undefined" ||
          typeof AmoCRM.constant !== "function"
        ) {
          console.log("AmoCRM не загружен или не инициализирован");
          return false;
        }
        return true;
      } catch (e) {
        console.error("Ошибка проверки AmoCRM API:", e);
        return false;
      }
    };

    this.isStandalone = !this.checkAMOCRM();

    // Инициализация данных с защитой от ошибок
    this.system = function () {
      try {
        if (!this.isStandalone && AmoCRM && AmoCRM.constant) {
          const account = AmoCRM.constant("account") || {};
          const user = AmoCRM.constant("user") || {};
          return {
            area: AmoCRM.constant("location") || "unknown",
            subdomain: account.subdomain || "yourdomain",
            account_id: account.id || null,
            user_id: user.id || null,
          };
        }
        return {
          area: "standalone",
          subdomain: "yourdomain",
        };
      } catch (e) {
        console.error("Ошибка получения системных данных:", e);
        return {
          area: "standalone",
          subdomain: "yourdomain",
        };
      }
    }.bind(this);

    // Безопасный доступ к языковым данным
    this.getLangData = function () {
      const defaultData = {
        widget: {
          name: "Календарь заказов",
          description: "Виджет для отображения сделок по дате заказа",
        },
        months: [
          "Январь",
          "Февраль",
          "Март",
          "Апрель",
          "Май",
          "Июнь",
          "Июль",
          "Август",
          "Сентябрь",
          "Октябрь",
          "Ноябрь",
          "Декабрь",
        ],
        weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        errors: {
          load: "Ошибка загрузки данных",
          noDeals: "Нет сделок на эту дату",
          noAuth: "Требуется авторизация в amoCRM",
          settingsSave: "Ошибка сохранения настроек",
          standalone: "Виджет работает в автономном режиме",
          apiNotLoaded: "AmoCRM API не загружен. Проверьте загрузку скриптов.",
          calendarError: "Ошибка при создании календаря",
        },
      };

      try {
        if (this.langs && this.langs.ru) {
          return {
            ...defaultData,
            ...this.langs.ru,
            widget: {
              ...defaultData.widget,
              ...(this.langs.ru.widget || {}),
            },
            errors: {
              ...defaultData.errors,
              ...(this.langs.ru.errors || {}),
            },
          };
        }
        return defaultData;
      } catch (e) {
        console.error("Ошибка получения языковых данных:", e);
        return defaultData;
      }
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      loading: false,
      fieldIds: { ORDER_DATE: 885453, DELIVERY_RANGE: null },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
      cache: { monthsData: {} },
    };

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ========== //
    this.formatDate = function (day, month, year) {
      return `${year}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    };

    this.getTodayDateString = function () {
      const today = new Date();
      return this.formatDate(
        today.getDate(),
        today.getMonth() + 1,
        today.getFullYear()
      );
    };

    this.getWidgetTitle = function () {
      const langData = this.getLangData();
      return langData.widget.name || "Календарь заказов";
    };

    this.getErrorMessage = function (key) {
      const langData = this.getLangData();
      return langData.errors[key] || "Неизвестная ошибка";
    };

    this.applySettings = function (settings) {
      if (settings && typeof settings === "object") {
        if (settings.deal_date_field_id) {
          const fieldId = parseInt(settings.deal_date_field_id);
          if (!isNaN(fieldId)) {
            self.state.fieldIds.ORDER_DATE = fieldId;
          }
        }
        if (settings.delivery_range_field) {
          const fieldId = parseInt(settings.delivery_range_field);
          if (!isNaN(fieldId)) {
            self.state.fieldIds.DELIVERY_RANGE = fieldId;
          }
        }
        return true;
      }
      return false;
    };

    this.showError = function (message) {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          widgetRoot.innerHTML = `
            <div class="error-message">
              <h3>${this.getWidgetTitle()}</h3>
              <p>${message || "Неизвестная ошибка"}</p>
              <div class="error-details" style="margin-top: 20px; color: #666;">
                <p>Режим: ${this.isStandalone ? "standalone" : "integrated"}</p>
                <p>Текущая локация: ${
                  (this.system() && this.system().area) || "unknown"
                }</p>
              </div>
            </div>
          `;
        }
      } catch (e) {
        console.error("Ошибка при отображении ошибки:", e);
      }
    };

    // ========== API МЕТОДЫ ========== //
    this.doRequest = function (method, path, data) {
      return new Promise(function (resolve, reject) {
        if (self.isStandalone) {
          setTimeout(() => {
            resolve({ _embedded: { leads: [] } });
          }, 300);
          return;
        }

        try {
          if (
            typeof AmoCRM === "undefined" ||
            typeof AmoCRM.API === "undefined" ||
            typeof AmoCRM.API.request !== "function"
          ) {
            return reject(new Error(self.getErrorMessage("apiNotLoaded")));
          }

          console.log("Отправка запроса к API:", { method, path, data });

          AmoCRM.API.request({
            method: method,
            path: path,
            data: data,
          })
            .then(function (response) {
              if (!response) {
                console.error("Пустой ответ от сервера");
                return reject(new Error("Пустой ответ сервера"));
              }
              console.log("Успешный ответ от API", response);
              resolve(response);
            })
            .catch(function (error) {
              console.error("Ошибка API запроса:", error);
              reject(new Error(self.getErrorMessage("load")));
            });
        } catch (e) {
          console.error("Критическая ошибка в doRequest:", e);
          reject(e);
        }
      });
    };

    // ========== ОТОБРАЖЕНИЕ КАЛЕНДАРЯ ========== //
    this.generateCalendarHTML = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const langData = this.getLangData();
        const monthNames = langData.months || [];
        const weekdays = langData.weekdays || [];

        let daysHTML = "";
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = this.formatDate(day, month + 1, year);
          const deals = this.state.dealsData[dateStr] || [];
          const isToday = dateStr === this.getTodayDateString();
          const hasDeals = deals.length > 0;

          daysHTML += `
            <div class="calendar-day ${isToday ? "today" : ""} ${
            hasDeals ? "has-deals" : ""
          }" 
                 data-date="${dateStr}">
              <div class="day-number">${day}</div>
              ${hasDeals ? `<div class="deal-count">${deals.length}</div>` : ""}
            </div>`;
        }

        return `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>${this.getWidgetTitle()}</h3>
              ${
                this.isStandalone
                  ? `<div class="standalone-warning">
                  <p>${langData.errors.standalone}</p>
                </div>`
                  : ""
              }
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">${
                  monthNames[month] || ""
                } ${year}</span>
                <button class="nav-button next-month">→</button>
              </div>
            </div>
            <div class="calendar-grid">
              ${weekdays
                .map((day) => `<div class="calendar-weekday">${day}</div>`)
                .join("")}
              ${Array(adjustedFirstDay)
                .fill('<div class="calendar-day empty"></div>')
                .join("")}
              ${daysHTML}
            </div>
            ${
              this.state.loading
                ? '<div class="loading-spinner">Загрузка данных...</div>'
                : ""
            }
          </div>`;
      } catch (e) {
        console.error("Ошибка при создании календаря:", e);
        this.showError(this.getErrorMessage("calendarError"));
        return '<div class="error-message">Ошибка при создании календаря</div>';
      }
    };

    this.updateCalendarView = function () {
      try {
        const html = self.generateCalendarHTML();

        if (!self.isStandalone && typeof self.render_template === "function") {
          self.render_template(
            {
              body: html,
              caption: {
                class_name: "orders-calendar-caption",
              },
            },
            {}
          );
        } else {
          const widgetRoot = document.getElementById("widget-root");
          if (widgetRoot) {
            widgetRoot.innerHTML = html;
            self.bindCalendarEvents();
          }
        }
      } catch (e) {
        console.error("Ошибка при обновлении календаря:", e);
        this.showError("Ошибка при обновлении календаря");
      }
    };

    // ========== CALLBACKS ДЛЯ AMOCRM ========== //
    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          try {
            console.log("Инициализация виджета...");
            self.isStandalone = !self.checkAMOCRM();

            if (self.isStandalone) {
              console.error("Виджет перешел в standalone режим");
              self.showError(self.getErrorMessage("apiNotLoaded"));
              return resolve(false);
            }

            const currentSettings = self.params || {};
            self.applySettings(currentSettings);

            self.state.initialized = true;
            console.log("Виджет успешно инициализирован");
            resolve(true);
          } catch (e) {
            console.error("Ошибка инициализации:", e);
            self.showError("Ошибка подключения к AmoCRM");
            resolve(false);
          }
        });
      },

      render: function () {
        return new Promise(function (resolve) {
          try {
            self.updateCalendarView();
            resolve(true);
          } catch (e) {
            console.error("Ошибка рендеринга:", e);
            self.showError("Ошибка отображения виджета");
            resolve(false);
          }
        });
      },

      onSave: function (newSettings) {
        return new Promise(function (resolve) {
          try {
            const result = self.applySettings(newSettings);
            if (result) {
              self.state.cache.monthsData = {};
              self.renderCalendar().then(() => resolve(true));
            } else {
              resolve(false);
            }
          } catch (e) {
            console.error("Ошибка сохранения настроек:", e);
            self.showError(self.getErrorMessage("settingsSave"));
            resolve(false);
          }
        });
      },

      bind_actions: function () {
        try {
          self.bindCalendarEvents();
          return true;
        } catch (e) {
          console.error("Ошибка привязки событий:", e);
          return false;
        }
      },

      destroy: function () {
        try {
          $(document).off("click.calendar");
          $(document).off("click.date");
          $(document).off("click.popup");
          return true;
        } catch (e) {
          console.error("Ошибка очистки:", e);
          return false;
        }
      },

      initMenuPage: function () {
        return this.callbacks.render();
      },

      renderCard: function () {
        return this.callbacks.render();
      },
    };

    // Инициализация виджета
    if (this.isStandalone) {
      console.log("Инициализация в standalone режиме");
      this.renderCalendar();
    }

    return this;
  };

  return OrdersCalendarWidget;
});

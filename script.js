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
        if (typeof AmoCRM === "undefined") {
          console.log("AmoCRM не загружен");
          return false;
        }
        return true;
      } catch (e) {
        console.error("Ошибка проверки AmoCRM API:", e);
        return false;
      }
    };

    this.isStandalone = !this.checkAMOCRM();

    // Инициализация данных
    this.system = function () {
      try {
        if (!this.isStandalone) {
          return {
            area: AmoCRM.constant("location") || "unknown",
            subdomain: AmoCRM.constant("account").subdomain || "yourdomain",
            account_id: AmoCRM.constant("account").id || null,
            user_id: AmoCRM.constant("user").id || null,
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

    // Локализация
    this.langs = {
      ru: {
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
        },
      },
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
      return this.langs.ru.widget.name;
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
              <p>${message}</p>
              <div class="error-details" style="margin-top: 20px; color: #666;">
                <p>Режим: ${this.isStandalone ? "standalone" : "integrated"}</p>
                <p>Текущая локация: ${this.system().area}</p>
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
          if (typeof AmoCRM === "undefined") {
            return reject(new Error(self.langs.ru.errors.apiNotLoaded));
          }

          console.log("Отправка запроса к API:", { method, path, data });

          // Используем стандартный метод AmoCRM для запросов
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
              reject(new Error(self.langs.ru.errors.load));
            });
        } catch (e) {
          console.error("Критическая ошибка в doRequest:", e);
          reject(e);
        }
      });
    };

    // ========== ЗАГРУЗКА ДАННЫХ ========== //
    this.loadData = function () {
      return new Promise(function (resolve) {
        try {
          console.log("Начало загрузки данных");
          self.state.loading = true;

          if (self.isStandalone) {
            console.log("Загрузка тестовых данных в standalone режиме");
            self.state.dealsData = {};
            self.state.loading = false;
            return resolve();
          }

          if (!self.state.fieldIds.ORDER_DATE) {
            console.error("Не настроено поле с датой заказа");
            self.showError("Не настроено поле с датой заказа");
            self.state.loading = false;
            return resolve();
          }

          const dateFrom = new Date(
            self.state.currentDate.getFullYear(),
            self.state.currentDate.getMonth(),
            1
          );
          const dateTo = new Date(
            self.state.currentDate.getFullYear(),
            self.state.currentDate.getMonth() + 1,
            0
          );

          console.log("Диапазон дат для запроса:", dateFrom, "до", dateTo);

          self
            .doRequest("GET", "/api/v4/leads", {
              filter: {
                custom_fields_values: [
                  {
                    field_id: self.state.fieldIds.ORDER_DATE,
                    from: Math.floor(dateFrom.getTime() / 1000),
                    to: Math.floor(dateTo.getTime() / 1000),
                  },
                ],
              },
              limit: 250,
              with: "contacts",
            })
            .then(function (response) {
              console.log("Ответ от API:", response);
              if (response && response._embedded && response._embedded.leads) {
                self.processData(response._embedded.leads);
              } else {
                console.warn("Нет данных о сделках в ответе");
                self.state.dealsData = {};
              }
            })
            .catch(function (error) {
              console.error("Ошибка загрузки данных:", error);
              self.showError(self.langs.ru.errors.load);
              self.state.dealsData = {};
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Неожиданная ошибка в loadData:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    this.processData = function (deals) {
      try {
        const newDealsData = {};

        if (!deals || !Array.isArray(deals)) {
          console.warn("Некорректные данные сделок:", deals);
          return;
        }

        deals.forEach(function (deal) {
          try {
            if (!deal || typeof deal !== "object") return;

            const dateField = (deal.custom_fields_values || []).find(function (
              f
            ) {
              return f && f.field_id === self.state.fieldIds.ORDER_DATE;
            });

            const timestamp =
              dateField &&
              dateField.values &&
              dateField.values[0] &&
              dateField.values[0].value;
            if (!timestamp) return;

            const date = new Date(timestamp * 1000);
            if (isNaN(date.getTime())) {
              console.warn("Некорректная дата в сделке:", deal.id, timestamp);
              return;
            }

            const dateStr = date.toISOString().split("T")[0];

            if (!newDealsData[dateStr]) {
              newDealsData[dateStr] = [];
            }

            newDealsData[dateStr].push({
              id: deal.id || 0,
              name: deal.name || "Без названия",
              status_id: deal.status_id || 0,
              price: deal.price || 0,
              contacts: (deal._embedded && deal._embedded.contacts) || [],
            });
          } catch (e) {
            console.warn("Ошибка обработки сделки:", e);
          }
        });

        this.state.dealsData = newDealsData;
      } catch (e) {
        console.error("Критическая ошибка в processData:", e);
      }
    };

    // ========== ОТОБРАЖЕНИЕ КАЛЕНДАРЯ ========== //
    this.generateCalendarHTML = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const monthNames = this.langs.ru.months;
        const weekdays = this.langs.ru.weekdays;

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
                  <p>${this.langs.ru.errors.standalone}</p>
                </div>`
                  : ""
              }
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">${monthNames[month]} ${year}</span>
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
        return '<div class="error-message">Ошибка при создании календаря</div>';
      }
    };

    this.renderCalendar = function () {
      return new Promise(function (resolve) {
        try {
          console.log("Начало renderCalendar");
          self.state.loading = true;
          const cacheKey = `${self.state.currentDate.getFullYear()}-${self.state.currentDate.getMonth()}`;

          if (self.state.cache.monthsData[cacheKey]) {
            console.log("Используем данные из кэша");
            self.state.dealsData = self.state.cache.monthsData[cacheKey];
            self.state.loading = false;
            self.updateCalendarView();
            return resolve();
          }

          console.log("Загружаем новые данные");
          self
            .loadData()
            .then(function () {
              console.log("Данные загружены, сохраняем в кэш");
              self.state.cache.monthsData[cacheKey] = {
                ...self.state.dealsData,
              };
              self.updateCalendarView();
            })
            .catch(function (e) {
              console.error("Ошибка рендеринга календаря:", e);
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Критическая ошибка в renderCalendar:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    this.updateCalendarView = function () {
      try {
        const html = self.generateCalendarHTML();

        // Используем render_template для интеграции с AmoCRM
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
          // Fallback для standalone режима
          const widgetRoot = document.getElementById("widget-root");
          if (widgetRoot) {
            widgetRoot.innerHTML = html;
            self.bindCalendarEvents();
          }
        }
      } catch (e) {
        console.error("Ошибка при обновлении календаря:", e);
      }
    };

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ========== //
    this.bindCalendarEvents = function () {
      try {
        $(document)
          .off("click.calendar")
          .on("click.calendar", ".prev-month", function () {
            self.state.currentDate.setMonth(
              self.state.currentDate.getMonth() - 1
            );
            self.renderCalendar();
          });

        $(document)
          .off("click.calendar")
          .on("click.calendar", ".next-month", function () {
            self.state.currentDate.setMonth(
              self.state.currentDate.getMonth() + 1
            );
            self.renderCalendar();
          });

        $(document)
          .off("click.date")
          .on("click.date", ".calendar-day:not(.empty)", function () {
            const dateStr = $(this).data("date");
            self.showDealsPopup(dateStr);
          });
      } catch (e) {
        console.error("Ошибка привязки событий календаря:", e);
      }
    };

    this.showDealsPopup = function (dateStr) {
      try {
        const deals = self.state.dealsData[dateStr] || [];
        const noDealsText = self.langs.ru.errors.noDeals;

        const dealsHTML = deals.length
          ? deals
              .map(
                (deal) => `
              <div class="deal-item" data-deal-id="${deal.id}">
                <h4>${deal.name}</h4>
                <p>Статус: ${
                  self.state.statuses[deal.status_id] || "Неизвестно"
                }</p>
                <p>Сумма: ${deal.price} руб.</p>
                ${
                  deal.contacts.length > 0
                    ? `<p>Контакты: ${deal.contacts
                        .map((c) => c.name || "Без имени")
                        .join(", ")}</p>`
                    : ""
                }
              </div>`
              )
              .join("")
          : `<p class="no-deals">${noDealsText}</p>`;

        const popupHTML = `
          <div class="deals-popup">
            <div class="popup-content">
              <h3>Сделки на ${dateStr}</h3>
              <div class="deals-list">${dealsHTML}</div>
              <button class="close-popup">Закрыть</button>
            </div>
          </div>`;

        $(".deals-popup").remove();
        $("#widget-root").append(popupHTML);

        $(document)
          .off("click.popup")
          .on("click.popup", ".close-popup", function () {
            $(".deals-popup").remove();
          });
      } catch (e) {
        console.error("Ошибка при отображении попапа:", e);
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
              self.showError(self.langs.ru.errors.apiNotLoaded);
              return resolve(false);
            }

            // Применяем настройки если они есть
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
          self
            .renderCalendar()
            .then(() => resolve(true))
            .catch((e) => {
              console.error("Ошибка рендеринга:", e);
              resolve(false);
            });
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
            self.showError(self.langs.ru.errors.settingsSave);
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

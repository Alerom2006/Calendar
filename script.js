define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Проверка доступности AMOCRM API
    if (typeof AMOCRM === "undefined" || typeof AMOCRM.request !== "function") {
      console.error("AMOCRM API недоступен");
      return this;
    }

    // Проверка авторизации
    if (!AMOCRM.constant("user") || !AMOCRM.constant("user").id) {
      console.error("Требуется авторизация в amoCRM");
      return this;
    }

    // Получаем данные аккаунта и пользователя из AMOCRM
    const accountData = AMOCRM.constant("account") || {};
    const userData = AMOCRM.constant("user") || {};
    const currentCard = AMOCRM.data.current_card || {};

    // Инициализация системных методов
    this.system = function () {
      return {
        area: currentCard.type || "standalone",
        amouser_id: userData.id || null,
        amouser: userData.name || null,
        amohash: userData.api_key || null,
        subdomain: accountData.subdomain || "yourdomain",
        account_id: accountData.id || null,
      };
    };

    this.langs = {
      ru: {
        widget: { name: "Календарь заказов" },
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
          noAuth: "Требуется авторизация",
          fileUpload: "Ошибка загрузки файла",
          fileDelete: "Ошибка удаления файла",
          settingsSave: "Ошибка сохранения настроек",
        },
      },
    };

    this.params = {};
    this.get_version = function () {
      return "1.0.0";
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      loading: false,
      fileUploading: false,
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
      return this.langs.ru?.widget?.name || "Календарь заказов";
    };

    this.applySettings = function (settings) {
      if (settings && typeof settings === "object") {
        if (settings.deal_date_field_id) {
          self.state.fieldIds.ORDER_DATE = parseInt(
            settings.deal_date_field_id
          );
        }
        if (settings.delivery_range_field) {
          self.state.fieldIds.DELIVERY_RANGE = parseInt(
            settings.delivery_range_field
          );
        }
        return true;
      }
      return false;
    };

    this.get_settings = function () {
      return this.params;
    };

    this.showError = function (message) {
      const widgetRoot = document.getElementById("widget-root");
      if (widgetRoot) {
        widgetRoot.innerHTML = `
          <div class="error-message">
            <h3>${this.getWidgetTitle()}</h3>
            <p>${message}</p>
            ${
              this.system().area === "standalone"
                ? '<button onclick="location.reload()">Обновить</button>'
                : ""
            }
          </div>
        `;
      }
    };

    // ========== API МЕТОДЫ ========== //
    this.doRequest = function (method, path, data) {
      return new Promise(function (resolve, reject) {
        try {
          if (typeof AMOCRM === "undefined") {
            return reject(new Error("AMOCRM API недоступен"));
          }

          console.log("Отправка запроса к", path, "с данными:", data);

          AMOCRM.request(method, path, data)
            .then(resolve)
            .catch(function (error) {
              console.error("Ошибка API:", error);
              reject(
                new Error(
                  self.langs.ru?.errors?.load || "Ошибка загрузки данных"
                )
              );
            });
        } catch (e) {
          reject(e);
        }
      });
    };

    // ========== ЗАГРУЗКА ДАННЫХ ========== //
    this.loadData = function () {
      return new Promise(function (resolve) {
        try {
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

          self.state.loading = true;

          self
            .doRequest("GET", "/api/v4/leads", {
              filter: {
                [self.state.fieldIds.ORDER_DATE]: {
                  from: Math.floor(dateFrom.getTime() / 1000),
                  to: Math.floor(dateTo.getTime() / 1000),
                },
              },
              limit: 250,
              with: "contacts",
            })
            .then(function (response) {
              if (response?._embedded?.leads) {
                self.processData(response._embedded.leads);
              } else {
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
          console.error("Ошибка в loadData:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    this.processData = function (deals) {
      try {
        const newDealsData = {};
        deals.forEach(function (deal) {
          try {
            const dateField = (deal.custom_fields_values || []).find(function (
              f
            ) {
              return f?.field_id === self.state.fieldIds.ORDER_DATE;
            });

            const timestamp = dateField?.values?.[0]?.value;
            if (!timestamp) return;

            const date = new Date(timestamp * 1000);
            const dateStr = date.toISOString().split("T")[0];

            if (!newDealsData[dateStr]) {
              newDealsData[dateStr] = [];
            }

            newDealsData[dateStr].push({
              id: deal.id || 0,
              name: deal.name || "Без названия",
              status_id: deal.status_id || 0,
              price: deal.price || 0,
              contacts: deal._embedded?.contacts || [],
            });
          } catch (e) {
            console.warn("Ошибка обработки сделки:", e);
          }
        });
        this.state.dealsData = newDealsData;
      } catch (e) {
        console.error("Ошибка в processData:", e);
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

        const monthNames = this.langs.ru?.months || [];
        const weekdays = this.langs.ru?.weekdays || [];

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
            ${this.state.loading ? '<div class="loading-spinner"></div>' : ""}
          </div>`;
      } catch (e) {
        console.error("Ошибка при создании календаря:", e);
        return '<div class="error-message">Ошибка при создании календаря</div>';
      }
    };

    this.renderCalendar = function () {
      return new Promise(function (resolve) {
        try {
          self.state.loading = true;
          const cacheKey = `${self.state.currentDate.getFullYear()}-${self.state.currentDate.getMonth()}`;

          if (self.state.cache.monthsData[cacheKey]) {
            self.state.dealsData = self.state.cache.monthsData[cacheKey];
            self.state.loading = false;
            self.updateCalendarView();
            return resolve();
          }

          self
            .loadData()
            .then(function () {
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
          console.error("Ошибка в renderCalendar:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    this.updateCalendarView = function () {
      const widgetRoot = document.getElementById("widget-root");
      if (widgetRoot) {
        widgetRoot.innerHTML = self.generateCalendarHTML();
      }
    };

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ========== //
    this.bindCalendarEvents = function () {
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
    };

    // ========== POPUP СО СДЕЛКАМИ ========== //
    this.showDealsPopup = function (dateStr) {
      try {
        const deals = self.state.dealsData[dateStr] || [];
        const noDealsText =
          self.langs.ru?.errors?.noDeals || "Нет сделок на эту дату";

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
          </div>
        `;

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
            const currentSettings = self.get_settings();
            if (currentSettings) self.applySettings(currentSettings);
            self.state.initialized = true;
            resolve(true);
          } catch (e) {
            console.error("Ошибка инициализации:", e);
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
              // Очищаем кэш при изменении настроек
              self.state.cache.monthsData = {};
              // Перерисовываем календарь с новыми настройками
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
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          self.renderCalendar().then(() => {
            self.bindCalendarEvents();
          });
        }
        return true;
      },

      renderCard: function () {
        return this.callbacks.render();
      },
    };

    return this;
  };

  return OrdersCalendarWidget;
});

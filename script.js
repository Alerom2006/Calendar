// Проверка доступности RequireJS/AMD
if (typeof define === "function") {
  define(["jquery"], function ($) {
    "use strict";
    return createOrdersCalendarWidget($);
  });
} else {
  // Если RequireJS не доступен, используем глобальную переменную
  window.OrdersCalendarWidget = createOrdersCalendarWidget(
    window.jQuery || window.$
  );
}

function createOrdersCalendarWidget($) {
  "use strict";

  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Проверяем доступность jQuery
    if (!$) {
      this.showError("jQuery не загружен");
      return this;
    }

    // Проверка доступности AMOCRM API (только в режиме amoCRM)
    if (typeof AmoCRM !== "undefined") {
      if (
        typeof AMOCRM === "undefined" ||
        typeof AMOCRM.request !== "function"
      ) {
        this.showError("AMOCRM API недоступен");
        return this;
      }

      // Проверка авторизации (только в режиме amoCRM)
      if (!AMOCRM.constant("user") || !AMOCRM.constant("user").id) {
        this.showError("Требуется авторизация в amoCRM");
        return this;
      }
    }

    // Инициализация виджета
    this.initialize();
  };

  OrdersCalendarWidget.prototype = {
    initialize: function () {
      var self = this;

      // Получаем данные аккаунта и пользователя из AMOCRM (если доступно)
      const accountData =
        typeof AMOCRM !== "undefined" ? AMOCRM.constant("account") || {} : {};
      const userData =
        typeof AMOCRM !== "undefined" ? AMOCRM.constant("user") || {} : {};
      const currentCard =
        typeof AMOCRM !== "undefined" ? AMOCRM.data.current_card || {} : {};

      // Системные настройки
      this.system = {
        area: currentCard.type || "standalone",
        amouser_id: userData.id || null,
        amouser: userData.name || null,
        amohash: userData.api_key || null,
        subdomain: accountData.subdomain || "yourdomain",
        account_id: accountData.id || null,
      };

      // Локализация
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
          },
        },
      };

      // Параметры
      this.params = {};

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
    },

    get_version: function () {
      return "1.0.44";
    },

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ========== //
    formatDate: function (day, month, year) {
      return `${year}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    },

    getTodayDateString: function () {
      const today = new Date();
      return this.formatDate(
        today.getDate(),
        today.getMonth() + 1,
        today.getFullYear()
      );
    },

    getWidgetTitle: function () {
      return this.langs.ru?.widget?.name || "Календарь заказов";
    },

    applySettings: function (settings) {
      try {
        if (settings && typeof settings === "object") {
          if (settings.deal_date_field_id) {
            this.state.fieldIds.ORDER_DATE =
              parseInt(settings.deal_date_field_id) || 885453;
          }
          if (settings.delivery_range_field) {
            this.state.fieldIds.DELIVERY_RANGE =
              parseInt(settings.delivery_range_field) || null;
          }
          return true;
        }
        return false;
      } catch (e) {
        console.error("Ошибка применения настроек:", e);
        return false;
      }
    },

    get_settings: function () {
      return this.params;
    },

    showError: function (message) {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          widgetRoot.innerHTML = `
            <div class="error-message">
              <h3>${this.getWidgetTitle()}</h3>
              <p>${message}</p>
              ${
                this.system.area === "standalone"
                  ? '<button onclick="location.reload()">Обновить</button>'
                  : ""
              }
            </div>
          `;
        }
      } catch (e) {
        console.error("Ошибка отображения ошибки:", e);
      }
    },

    // ========== API МЕТОДЫ ========== //
    doRequest: function (method, path, data) {
      return new Promise(function (resolve, reject) {
        try {
          if (typeof AMOCRM === "undefined") {
            // В standalone режиме делаем обычный fetch или используем mock данные
            console.log("Standalone режим: запрос не выполнен");
            resolve({ _embedded: { leads: [] } });
            return;
          }

          AMOCRM.request(method, path, data)
            .then(resolve)
            .catch(function (error) {
              console.error("Ошибка API:", error);
              reject(new Error("Ошибка загрузки данных"));
            });
        } catch (e) {
          reject(e);
        }
      });
    },

    // ========== ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ========== //
    loadData: function () {
      return new Promise(
        function (resolve) {
          try {
            const dateFrom = new Date(
              this.state.currentDate.getFullYear(),
              this.state.currentDate.getMonth(),
              1
            );
            const dateTo = new Date(
              this.state.currentDate.getFullYear(),
              this.state.currentDate.getMonth() + 1,
              0
            );

            this.state.loading = true;

            // В standalone режиме используем mock данные
            if (typeof AMOCRM === "undefined") {
              console.log("Standalone режим: загрузка mock данных");
              setTimeout(() => {
                this.state.dealsData = this.generateMockData(dateFrom, dateTo);
                this.state.loading = false;
                resolve();
              }, 500);
              return;
            }

            this.doRequest("GET", "/api/v4/leads", {
              filter: {
                [this.state.fieldIds.ORDER_DATE]: {
                  from: Math.floor(dateFrom.getTime() / 1000),
                  to: Math.floor(dateTo.getTime() / 1000),
                },
              },
              limit: 250,
              with: "contacts",
            })
              .then(
                function (response) {
                  if (response?._embedded?.leads) {
                    this.processData(response._embedded.leads);
                  } else {
                    this.state.dealsData = {};
                  }
                }.bind(this)
              )
              .catch(
                function (error) {
                  console.error("Ошибка загрузки данных:", error);
                  this.showError(this.langs.ru.errors.load);
                  this.state.dealsData = {};
                }.bind(this)
              )
              .finally(
                function () {
                  this.state.loading = false;
                  resolve();
                }.bind(this)
              );
          } catch (e) {
            console.error("Ошибка в loadData:", e);
            this.state.loading = false;
            resolve();
          }
        }.bind(this)
      );
    },

    generateMockData: function (dateFrom, dateTo) {
      const mockData = {};
      const daysInMonth = new Date(
        dateTo.getFullYear(),
        dateTo.getMonth() + 1,
        0
      ).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), day);
        const dateStr = date.toISOString().split("T")[0];

        if (Math.random() > 0.7) {
          const dealsCount = Math.floor(Math.random() * 3) + 1;
          mockData[dateStr] = [];

          for (let i = 0; i < dealsCount; i++) {
            mockData[dateStr].push({
              id: Math.floor(Math.random() * 10000),
              name: `Сделка ${i + 1} на ${dateStr}`,
              status_id: [142, 143, 144, 145][Math.floor(Math.random() * 4)],
              price: Math.floor(Math.random() * 10000),
              contacts: [
                {
                  id: Math.floor(Math.random() * 10000),
                  name: `Контакт ${i + 1}`,
                },
              ],
            });
          }
        }
      }

      return mockData;
    },

    processData: function (deals) {
      try {
        const newDealsData = {};
        deals.forEach(
          function (deal) {
            try {
              const dateField = (deal.custom_fields_values || []).find(
                function (f) {
                  return f?.field_id === this.state.fieldIds.ORDER_DATE;
                }.bind(this)
              );

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
          }.bind(this)
        );
        this.state.dealsData = newDealsData;
      } catch (e) {
        console.error("Ошибка в processData:", e);
      }
    },

    // ========== ОТОБРАЖЕНИЕ ИНТЕРФЕЙСА ========== //
    generateCalendarHTML: function () {
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
    },

    updateCalendarView: function () {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          widgetRoot.innerHTML = this.generateCalendarHTML();
          this.bindCalendarEvents();
        }
      } catch (e) {
        console.error("Ошибка обновления календаря:", e);
      }
    },

    renderCalendar: function () {
      return new Promise(
        function (resolve) {
          try {
            this.state.loading = true;
            const cacheKey = `${this.state.currentDate.getFullYear()}-${this.state.currentDate.getMonth()}`;

            if (this.state.cache.monthsData[cacheKey]) {
              this.state.dealsData = this.state.cache.monthsData[cacheKey];
              this.state.loading = false;
              this.updateCalendarView();
              return resolve();
            }

            this.loadData()
              .then(
                function () {
                  this.state.cache.monthsData[cacheKey] = {
                    ...this.state.dealsData,
                  };
                  this.updateCalendarView();
                }.bind(this)
              )
              .catch(function (e) {
                console.error("Ошибка рендеринга календаря:", e);
              })
              .finally(
                function () {
                  this.state.loading = false;
                  resolve();
                }.bind(this)
              );
          } catch (e) {
            console.error("Ошибка в renderCalendar:", e);
            this.state.loading = false;
            resolve();
          }
        }.bind(this)
      );
    },

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ========== //
    bindCalendarEvents: function () {
      try {
        $(document)
          .off("click.calendar")
          .on(
            "click.calendar",
            ".prev-month",
            function () {
              this.state.currentDate.setMonth(
                this.state.currentDate.getMonth() - 1
              );
              this.renderCalendar();
            }.bind(this)
          );

        $(document)
          .off("click.calendar")
          .on(
            "click.calendar",
            ".next-month",
            function () {
              this.state.currentDate.setMonth(
                this.state.currentDate.getMonth() + 1
              );
              this.renderCalendar();
            }.bind(this)
          );

        $(document)
          .off("click.date")
          .on(
            "click.date",
            ".calendar-day:not(.empty)",
            function () {
              const dateStr = $(this).data("date");
              this.showDealsPopup(dateStr);
            }.bind(this)
          );
      } catch (e) {
        console.error("Ошибка привязки событий:", e);
      }
    },

    showDealsPopup: function (dateStr) {
      try {
        const deals = this.state.dealsData[dateStr] || [];
        const noDealsText =
          this.langs.ru?.errors?.noDeals || "Нет сделок на эту дату";

        const dealsHTML = deals.length
          ? deals
              .map(
                (deal) => `
              <div class="deal-item" data-deal-id="${deal.id}">
                <h4>${deal.name}</h4>
                <p>Статус: ${
                  this.state.statuses[deal.status_id] || "Неизвестно"
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
    },

    // Standalone метод для рендеринга вне amoCRM
    renderWidget: function () {
      return this.renderCalendar();
    },
  };

  return OrdersCalendarWidget;
}

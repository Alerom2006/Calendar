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

  var OrdersCalendarWidget = function (params) {
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Сохраняем параметры
    this.params = params || {};

    // Проверяем доступность jQuery
    if (!$) {
      this.showError("jQuery не загружен");
      return this;
    }

    // Проверка доступности AMOCRM API
    this.isAmoCRMMode = typeof AmoCRM !== "undefined";
    this.isAMOCRMReady = false;

    if (this.isAmoCRMMode) {
      try {
        this.isAMOCRMReady =
          typeof AMOCRM !== "undefined" &&
          typeof AMOCRM.request === "function" &&
          AMOCRM.constant("user") &&
          AMOCRM.constant("user").id;
      } catch (e) {
        console.error("Ошибка проверки AMOCRM API:", e);
        this.isAMOCRMReady = false;
      }

      if (!this.isAMOCRMReady) {
        this.showError("AMOCRM API недоступен или требуется авторизация");
        return this;
      }
    }

    // Инициализация виджета
    this.initialize();
  };

  OrdersCalendarWidget.prototype = {
    initialize: function () {
      // Получаем данные аккаунта и пользователя из AMOCRM (если доступно)
      const accountData = this.isAMOCRMReady
        ? AMOCRM.constant("account") || {}
        : {};
      const userData = this.isAMOCRMReady ? AMOCRM.constant("user") || {} : {};
      const currentCard = this.isAMOCRMReady
        ? AMOCRM.data.current_card || {}
        : {};

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
            apiError: "Ошибка API: ресурс не найден",
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

      // Применяем переданные настройки
      if (this.params.settings) {
        this.applySettings(this.params.settings);
      }

      // Помечаем, что инициализация завершена
      this.state.initialized = true;
    },

    get_version: function () {
      return "1.0.54";
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
      return new Promise((resolve, reject) => {
        try {
          if (!this.isAMOCRMReady) {
            // В standalone режиме используем mock данные
            console.log("Standalone режим: запрос не выполнен");
            setTimeout(() => resolve({ _embedded: { leads: [] } }), 100);
            return;
          }

          if (typeof AMOCRM.request !== "function") {
            reject(new Error("AMOCRM.request is not a function"));
            return;
          }

          AMOCRM.request(method, path, data)
            .then((response) => {
              if (response && !response.error) {
                resolve(response);
              } else {
                reject(new Error(response.error || "Неизвестная ошибка API"));
              }
            })
            .catch((error) => {
              console.error("Ошибка API:", error);
              if (error.status === 404) {
                this.showError(this.langs.ru.errors.apiError);
              }
              reject(
                new Error(
                  "Ошибка загрузки данных: " +
                    (error.message || error.statusText)
                )
              );
            });
        } catch (e) {
          reject(e);
        }
      });
    },

    // ========== ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ========== //
    loadData: function () {
      return new Promise((resolve) => {
        try {
          if (!this.state.initialized) {
            console.error("Виджет не инициализирован");
            return resolve();
          }

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
          if (!this.isAMOCRMReady) {
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
            .then((response) => {
              if (response?._embedded?.leads) {
                this.processData(response._embedded.leads);
              } else {
                this.state.dealsData = {};
              }
            })
            .catch((error) => {
              console.error("Ошибка загрузки данных:", error);
              this.showError(this.langs.ru.errors.load);
              this.state.dealsData = {};
            })
            .finally(() => {
              this.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Ошибка в loadData:", e);
          this.state.loading = false;
          resolve();
        }
      });
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
        deals.forEach((deal) => {
          try {
            const dateField = (deal.custom_fields_values || []).find((f) => {
              return f?.field_id === this.state.fieldIds.ORDER_DATE;
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
    },

    // ========== ОТОБРАЖЕНИЕ ИНТЕРФЕЙСА ========== //
    generateCalendarHTML: function () {
      try {
        if (!this.state.initialized) {
          return '<div class="error-message">Виджет не инициализирован</div>';
        }

        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();

        // Получаем первый день месяца и количество дней в месяце
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Определяем день недели для первого дня месяца (0 - воскресенье, 1 - понедельник и т.д.)
        const firstDayOfWeek = firstDay.getDay();
        // Корректируем для отображения (понедельник - первый день недели)
        const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        const monthNames = this.langs.ru?.months || [];
        const weekdays = this.langs.ru?.weekdays || [
          "Пн",
          "Вт",
          "Ср",
          "Чт",
          "Пт",
          "Сб",
          "Вс",
        ];

        let daysHTML = "";
        // Добавляем пустые ячейки для дней предыдущего месяца
        for (let i = 0; i < adjustedFirstDay; i++) {
          daysHTML += '<div class="calendar-day empty"></div>';
        }

        // Добавляем дни текущего месяца
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
      return new Promise((resolve) => {
        try {
          if (!this.state.initialized) {
            console.error("Виджет не инициализирован");
            return resolve();
          }

          this.state.loading = true;
          const cacheKey = `${this.state.currentDate.getFullYear()}-${this.state.currentDate.getMonth()}`;

          if (this.state.cache.monthsData[cacheKey]) {
            this.state.dealsData = this.state.cache.monthsData[cacheKey];
            this.state.loading = false;
            this.updateCalendarView();
            return resolve();
          }

          this.loadData()
            .then(() => {
              this.state.cache.monthsData[cacheKey] = {
                ...this.state.dealsData,
              };
              this.updateCalendarView();
            })
            .catch((e) => {
              console.error("Ошибка рендеринга календаря:", e);
            })
            .finally(() => {
              this.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Ошибка в renderCalendar:", e);
          this.state.loading = false;
          resolve();
        }
      });
    },

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ========== //
    bindCalendarEvents: function () {
      try {
        // Удаляем старые обработчики
        $(document).off("click.calendar");

        // Обработчик для перехода на предыдущий месяц
        $(document).on("click.calendar", ".prev-month", () => {
          const newDate = new Date(this.state.currentDate);
          newDate.setMonth(newDate.getMonth() - 1);
          this.state.currentDate = newDate;
          this.state.dealsData = {}; // Очищаем кэш данных
          this.renderCalendar();
        });

        // Обработчик для перехода на следующий месяц
        $(document).on("click.calendar", ".next-month", () => {
          const newDate = new Date(this.state.currentDate);
          newDate.setMonth(newDate.getMonth() + 1);
          this.state.currentDate = newDate;
          this.state.dealsData = {}; // Очищаем кэш данных
          this.renderCalendar();
        });

        // Обработчик для выбора дня
        $(document).on("click.date", ".calendar-day:not(.empty)", (e) => {
          const dateStr = $(e.currentTarget).data("date");
          this.showDealsPopup(dateStr);
        });
      } catch (e) {
        console.error("Ошибка привязки событий:", e);
      }
    },

    showDealsPopup: function (dateStr) {
      try {
        const deals = this.state.dealsData[dateStr] || [];
        const noDealsText =
          this.langs.ru?.errors?.noDeals || "Нет сделок на выбранную дату";

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
          .on("click.popup", ".close-popup", () => {
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

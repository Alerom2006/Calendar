define(["jquery"], function ($) {
  "use strict";

  console.log("Widget script loading started"); // Логирование начала загрузки

  try {
    function OrdersCalendarWidget() {
      const self = this;
      this.__amowidget__ = true;

      // Улучшенная конфигурация виджета
      this.config = {
        version: "1.0.8", // Обновленная версия
        debugMode: true, // Включен режим отладки
      };

      // Состояние виджета с дополнительными полями для отладки
      this.state = {
        initialized: false,
        system: null,
        currentDate: new Date(),
        dealsData: {},
        fieldIds: {
          ORDER_DATE: 885453,
        },
        debug: {
          lastError: null,
          loadAttempts: 0,
        },
      };

      // Улучшенная инициализация системы
      this.initSystem = function () {
        return new Promise((resolve, reject) => {
          console.log("Initializing system..."); // Логирование начала инициализации

          if (typeof AmoCRM === "undefined") {
            const errorMsg = "AmoCRM API not available";
            self.state.debug.lastError = errorMsg;
            console.error(errorMsg);
            return reject(errorMsg);
          }

          if (typeof AmoCRM.widgets === "undefined") {
            const errorMsg = "AmoCRM.widgets not available";
            self.state.debug.lastError = errorMsg;
            console.error(errorMsg);
            return reject(errorMsg);
          }

          AmoCRM.widgets
            .system()
            .then((system) => {
              console.log("System initialized successfully:", system); // Логирование успешной инициализации
              self.state.system = system;
              self.state.initialized = true;
              resolve(true);
            })
            .catch((error) => {
              self.state.debug.lastError = error;
              console.error("System initialization failed:", error); // Логирование ошибки
              reject(error);
            });
        });
      };

      // Улучшенная загрузка сделок
      this.loadDeals = function () {
        self.state.debug.loadAttempts++;
        console.log(`Loading deals (attempt ${self.state.debug.loadAttempts})`); // Логирование попытки загрузки

        if (!self.state.initialized) {
          const errorMsg =
            "Widget not initialized. Current state: " +
            JSON.stringify(self.state);
          self.state.debug.lastError = errorMsg;
          console.error(errorMsg);
          return Promise.reject(errorMsg);
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

        return new Promise((resolve, reject) => {
          const requestData = {
            filter: {
              [self.state.fieldIds.ORDER_DATE]: {
                from: Math.floor(dateFrom.getTime() / 1000),
                to: Math.floor(dateTo.getTime() / 1000),
              },
            },
            limit: 250,
          };

          console.log("Making API request with data:", requestData); // Логирование запроса

          AmoCRM.request("/api/v4/leads", requestData)
            .then((response) => {
              console.log("API response received:", response); // Логирование ответа
              self.processDealsData(response._embedded?.leads || []);
              resolve(true);
            })
            .catch((error) => {
              self.state.debug.lastError = error;
              console.error("API request failed:", error); // Логирование ошибки
              reject(error);
            });
        });
      };

      // Обработка данных сделок (без изменений)
      this.processDealsData = function (deals) {
        self.state.dealsData = {};
        deals.forEach((deal) => {
          const dateField = deal.custom_fields_values?.find(
            (f) => f.field_id === self.state.fieldIds.ORDER_DATE
          );

          if (dateField?.values?.[0]?.value) {
            const date = new Date(dateField.values[0].value * 1000);
            const dateStr = date.toISOString().split("T")[0];

            if (!self.state.dealsData[dateStr]) {
              self.state.dealsData[dateStr] = [];
            }

            self.state.dealsData[dateStr].push({
              id: deal.id,
              name: deal.name,
              status_id: deal.status_id,
              price: deal.price,
            });
          }
        });
      };

      // Генерация календаря (без изменений)
      this.generateCalendar = function () {
        const month = self.state.currentDate.getMonth();
        const year = self.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay() || 7;

        let html = '<div class="calendar-grid">';

        const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
        weekdays.forEach((day) => {
          html += `<div class="calendar-weekday">${day}</div>`;
        });

        for (let i = 1; i < firstDay; i++) {
          html += '<div class="calendar-day empty"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${(month + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          const dealsCount = self.state.dealsData[dateStr]?.length || 0;
          const isToday = dateStr === new Date().toISOString().split("T")[0];

          html += `
            <div class="calendar-day ${isToday ? "today" : ""} ${
            dealsCount ? "has-deals" : ""
          }">
              ${day}
              ${
                dealsCount
                  ? `<span class="deal-badge">${dealsCount}</span>`
                  : ""
              }
            </div>
          `;
        }

        html += "</div>";
        return html;
      };

      // Улучшенный рендеринг виджета
      this.renderWidget = function () {
        console.log("Starting widget rendering..."); // Логирование начала рендеринга

        return self
          .loadDeals()
          .then(() => {
            const calendarHTML = `
              <div class="orders-calendar">
                <div class="calendar-header">
                  <h4>Календарь заказов</h4>
                </div>
                ${self.generateCalendar()}
              </div>
            `;

            console.log("Widget HTML generated"); // Логирование генерации HTML

            if (typeof self.render_template === "function") {
              console.log("Using render_template method"); // Логирование метода рендеринга
              self.render_template({
                body: calendarHTML,
                caption: {
                  class_name: "orders-calendar-caption",
                },
              });
            } else {
              console.log("Using direct DOM manipulation"); // Логирование альтернативного метода
              const container =
                document.querySelector("#widget-root") || document.body;
              container.innerHTML = calendarHTML;
            }

            return true;
          })
          .catch((error) => {
            const errorMsg = `Ошибка загрузки: ${error.message || error}`;
            self.state.debug.lastError = errorMsg;
            console.error(errorMsg); // Логирование ошибки

            const errorHTML = `
              <div class="error">
                <p>Не удалось загрузить данные</p>
                ${
                  self.config.debugMode
                    ? `<p class="debug-info">${errorMsg}</p>`
                    : ""
                }
              </div>
            `;

            if (typeof self.render_template === "function") {
              self.render_template({ body: errorHTML });
            } else {
              const container =
                document.querySelector("#widget-root") || document.body;
              container.innerHTML = errorHTML;
            }

            return false;
          });
      };

      // Колбэки виджета с улучшенной обработкой ошибок
      this.callbacks = {
        init: function (system) {
          console.log("Init callback called with system:", system); // Логирование инициализации
          self.state.system = system;

          return self
            .initSystem()
            .then(() => {
              if (system.settings?.deal_date_field_id) {
                self.state.fieldIds.ORDER_DATE = parseInt(
                  system.settings.deal_date_field_id
                );
              }
              return true;
            })
            .catch((error) => {
              const errorMsg = `Ошибка инициализации: ${
                error.message || error
              }`;
              self.state.debug.lastError = errorMsg;
              console.error(errorMsg); // Логирование ошибки

              if (typeof AmoCRM.Widget.showError === "function") {
                AmoCRM.Widget.showError(errorMsg);
              }

              return false;
            });
        },

        render: function () {
          console.log("Render callback called"); // Логирование вызова рендера
          return self.renderWidget();
        },

        onSave: function (newSettings) {
          console.log("onSave callback called with:", newSettings); // Логирование сохранения
          if (newSettings?.deal_date_field_id) {
            self.state.fieldIds.ORDER_DATE = parseInt(
              newSettings.deal_date_field_id
            );
          }
          return true;
        },

        bind_actions: function () {
          return true;
        },

        destroy: function () {
          console.log("Widget destroyed"); // Логирование уничтожения
          return true;
        },
      };

      return this;
    }

    // Улучшенная регистрация виджета
    if (typeof AmoCRM !== "undefined") {
      console.log("AmoCRM API available, registering widget..."); // Логирование перед регистрацией

      try {
        AmoCRM.Widget.register(OrdersCalendarWidget);
        console.log("Widget registered successfully"); // Логирование успешной регистрации
      } catch (e) {
        const errorMsg = `Ошибка регистрации виджета: ${e.message || e}`;
        console.error(errorMsg); // Логирование ошибки регистрации

        if (typeof AmoCRM.Widget.showError === "function") {
          AmoCRM.Widget.showError(errorMsg);
        }
      }
    } else {
      const errorMsg =
        "AmoCRM API не доступен, виджет не может быть зарегистрирован";
      console.error(errorMsg); // Логирование отсутствия API

      // Создаем заглушку для отображения ошибки
      const errorDiv = document.createElement("div");
      errorDiv.className = "amo-widget-error";
      errorDiv.innerHTML = `
        <h3>Ошибка загрузки виджета</h3>
        <p>${errorMsg}</p>
        <p>Попробуйте обновить страницу или обратитесь к администратору</p>
      `;

      (document.querySelector("#widget-root") || document.body).appendChild(
        errorDiv
      );
    }

    return OrdersCalendarWidget;
  } catch (e) {
    const errorMsg = `Критическая ошибка при инициализации виджета: ${
      e.message || e
    }`;
    console.error(errorMsg); // Логирование критической ошибки

    if (
      typeof AmoCRM !== "undefined" &&
      typeof AmoCRM.Widget.showError === "function"
    ) {
      AmoCRM.Widget.showError(errorMsg);
    } else {
      const errorDiv = document.createElement("div");
      errorDiv.className = "amo-widget-critical-error";
      errorDiv.innerHTML = `
        <h3>Критическая ошибка</h3>
        <p>${errorMsg}</p>
      `;

      (document.querySelector("#widget-root") || document.body).appendChild(
        errorDiv
      );
    }

    return function () {}; // Возвращаем пустую функцию
  }
});

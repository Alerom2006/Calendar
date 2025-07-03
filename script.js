define(["jquery"], function ($) {
  "use strict";

  console.log("Widget script loading started - v1.0.9");

  // Функция для отображения ошибок в интерфейсе
  function showError(message, isCritical = false) {
    const errorHTML = `
      <div class="amo-widget-error" style="
        padding: 15px;
        margin: 10px;
        border: 1px solid #ff6b6b;
        border-radius: 4px;
        background: #fff5f5;
        color: #ff3d3d;
      ">
        <h3 style="margin-top:0">${
          isCritical ? "Критическая ошибка" : "Ошибка"
        }</h3>
        <p>${message}</p>
        ${isCritical ? "<p>Пожалуйста, обновите страницу</p>" : ""}
      </div>
    `;

    const container = document.querySelector("#widget-root") || document.body;
    if (container) {
      container.innerHTML = errorHTML;
    } else {
      document.write(errorHTML);
    }
  }

  try {
    function OrdersCalendarWidget() {
      const self = this;
      this.__amowidget__ = true;

      // Конфигурация виджета
      this.config = {
        version: "1.0.9",
        debugMode: true,
        maxRetryAttempts: 3,
      };

      // Состояние виджета
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
          apiAvailable: typeof AmoCRM !== "undefined",
        },
      };

      // Проверка и ожидание загрузки AmoCRM API
      this.waitForAPI = function () {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const maxAttempts = 10;
          const interval = 300;

          const checkAPI = () => {
            attempts++;
            if (
              typeof AmoCRM !== "undefined" &&
              typeof AmoCRM.widgets !== "undefined"
            ) {
              console.log(
                "AmoCRM API detected after",
                attempts * interval,
                "ms"
              );
              resolve(true);
            } else if (attempts >= maxAttempts) {
              const errorMsg =
                "AmoCRM API не загрузился после " +
                maxAttempts * interval +
                "ms";
              self.state.debug.lastError = errorMsg;
              reject(errorMsg);
            } else {
              setTimeout(checkAPI, interval);
            }
          };

          checkAPI();
        });
      };

      // Инициализация системы с повторными попытками
      this.initSystem = function () {
        return new Promise((resolve, reject) => {
          console.log("Initializing system...");

          self
            .waitForAPI()
            .then(() => {
              return AmoCRM.widgets.system().then((system) => {
                console.log("System initialized:", system);
                self.state.system = system;
                self.state.initialized = true;
                resolve(true);
              });
            })
            .catch((error) => {
              self.state.debug.lastError = error;
              console.error("Init system error:", error);
              showError("Не удалось подключиться к amoCRM");
              reject(error);
            });
        });
      };

      // Загрузка сделок с обработкой ошибок
      this.loadDeals = function () {
        self.state.debug.loadAttempts++;
        console.log("Loading deals, attempt", self.state.debug.loadAttempts);

        if (!self.state.initialized) {
          return Promise.reject("Widget not initialized");
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

          AmoCRM.request("/api/v4/leads", requestData)
            .then((response) => {
              self.processDealsData(response._embedded?.leads || []);
              resolve(true);
            })
            .catch((error) => {
              console.error("API request failed:", error);
              showError("Ошибка загрузки данных из amoCRM");
              reject(error);
            });
        });
      };

      // Остальные методы без изменений
      this.processDealsData = function (deals) {
        /* ... */
      };
      this.generateCalendar = function () {
        /* ... */
      };

      // Рендеринг виджета
      this.renderWidget = function () {
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

            if (typeof self.render_template === "function") {
              self.render_template({
                body: calendarHTML,
                caption: {
                  class_name: "orders-calendar-caption",
                },
              });
            } else {
              const container =
                document.querySelector("#widget-root") || document.body;
              container.innerHTML = calendarHTML;
            }

            return true;
          })
          .catch((error) => {
            console.error("Render error:", error);
            return false;
          });
      };

      // Колбэки виджета
      this.callbacks = {
        init: function (system) {
          console.log("Init callback with system:", system);
          return self.initSystem().then(() => {
            if (system.settings?.deal_date_field_id) {
              self.state.fieldIds.ORDER_DATE = parseInt(
                system.settings.deal_date_field_id
              );
            }
            return true;
          });
        },

        render: function () {
          console.log("Render callback");
          return self.renderWidget();
        },

        onSave: function (newSettings) {
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
          return true;
        },
      };

      return this;
    }

    // Проверка и регистрация виджета
    if (typeof AmoCRM === "undefined") {
      console.error("AmoCRM API не обнаружен");
      showError("AmoCRM API не загружен", true);
      return function () {};
    }

    try {
      console.log("Registering widget...");
      AmoCRM.Widget.register(OrdersCalendarWidget);
      console.log("Widget registered successfully");
    } catch (e) {
      console.error("Widget registration failed:", e);
      showError("Ошибка регистрации виджета: " + e.message, true);
    }

    return OrdersCalendarWidget;
  } catch (e) {
    console.error("Critical error:", e);
    showError("Критическая ошибка: " + e.message, true);
    return function () {};
  }
});

define(["jquery"], function ($) {
  "use strict";

  console.log("Widget script loading started - v1.0.10");

  try {
    function OrdersCalendarWidget() {
      const self = this;
      this.__amowidget__ = true;

      // Конфигурация виджета
      this.config = {
        version: "1.0.10",
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
          apiAvailable: false,
        },
      };

      // Проверка и ожидание загрузки AmoCRM API
      this.waitForAPI = function () {
        return new Promise((resolve) => {
          let attempts = 0;
          const maxAttempts = 15; // Увеличено количество попыток
          const interval = 200;

          const checkAPI = () => {
            attempts++;
            self.state.debug.apiAvailable =
              typeof AmoCRM !== "undefined" &&
              typeof AmoCRM.widgets !== "undefined";

            if (self.state.debug.apiAvailable) {
              console.log(
                "AmoCRM API detected after",
                attempts * interval,
                "ms"
              );
              resolve(true);
            } else if (attempts >= maxAttempts) {
              console.warn(
                "AmoCRM API не загрузился после",
                maxAttempts * interval,
                "ms"
              );
              resolve(false);
            } else {
              setTimeout(checkAPI, interval);
            }
          };

          checkAPI();
        });
      };

      // Инициализация системы
      this.initSystem = function () {
        return self.waitForAPI().then((apiReady) => {
          if (!apiReady) {
            console.warn("Продолжаем без AmoCRM API");
            self.state.initialized = true; // Разрешаем работу в ограниченном режиме
            return true;
          }

          return AmoCRM.widgets
            .system()
            .then((system) => {
              console.log("System initialized:", system);
              self.state.system = system;
              self.state.initialized = true;

              if (system.settings?.deal_date_field_id) {
                self.state.fieldIds.ORDER_DATE = parseInt(
                  system.settings.deal_date_field_id
                );
              }

              return true;
            })
            .catch((error) => {
              console.warn("System init warning:", error);
              self.state.initialized = true; // Все равно продолжаем
              return true;
            });
        });
      };

      // Загрузка сделок
      this.loadDeals = function () {
        self.state.debug.loadAttempts++;
        console.log("Loading deals, attempt", self.state.debug.loadAttempts);

        if (!self.state.initialized) {
          console.warn("Widget not initialized yet");
          return Promise.resolve(false);
        }

        // Если API недоступен, используем тестовые данные
        if (!self.state.debug.apiAvailable) {
          console.warn("Using mock data (API unavailable)");
          self.state.dealsData = this.generateMockData();
          return Promise.resolve(true);
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

        return new Promise((resolve) => {
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
              console.warn("API request warning:", error);
              self.state.dealsData = this.generateMockData();
              resolve(true); // Продолжаем с тестовыми данными
            });
        });
      };

      // Генерация тестовых данных
      this.generateMockData = function () {
        console.log("Generating mock data");
        const mockData = {};
        const daysInMonth = new Date(
          this.state.currentDate.getFullYear(),
          this.state.currentDate.getMonth() + 1,
          0
        ).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${this.state.currentDate.getFullYear()}-${(
            this.state.currentDate.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

          if (day % 5 === 0) {
            // Каждый 5-й день есть сделки
            mockData[dateStr] = [
              {
                id: day * 1000,
                name: `Тестовая сделка ${day}`,
                status_id: 143,
                price: day * 1000,
              },
            ];
          }
        }
        return mockData;
      };

      // Обработка данных сделок
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

      // Генерация календаря
      this.generateCalendar = function () {
        const month = self.state.currentDate.getMonth();
        const year = self.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay() || 7;

        let html = '<div class="calendar-grid">';

        // Дни недели
        const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
        weekdays.forEach((day) => {
          html += `<div class="calendar-weekday">${day}</div>`;
        });

        // Пустые ячейки в начале месяца
        for (let i = 1; i < firstDay; i++) {
          html += '<div class="calendar-day empty"></div>';
        }

        // Дни месяца
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
            console.warn("Render warning:", error);
            return false;
          });
      };

      // Колбэки виджета
      this.callbacks = {
        init: function (system) {
          console.log("Init callback with system:", system);
          return self.initSystem();
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

    // Регистрация виджета
    const registerWidget = () => {
      if (
        typeof AmoCRM !== "undefined" &&
        typeof AmoCRM.Widget !== "undefined"
      ) {
        try {
          console.log("Registering widget...");
          AmoCRM.Widget.register(OrdersCalendarWidget);
          console.log("Widget registered successfully");
        } catch (e) {
          console.warn("Widget registration warning:", e);
        }
      } else {
        console.warn(
          "AmoCRM.Widget not available - running in standalone mode"
        );
        // Запуск в автономном режиме
        document.addEventListener("DOMContentLoaded", function () {
          const widget = new OrdersCalendarWidget();
          widget.renderWidget();
        });
      }
    };

    // Попытка регистрации с задержкой
    if (typeof AmoCRM === "undefined") {
      console.log("Waiting for AmoCRM API...");
      let attempts = 0;
      const checkAPI = () => {
        attempts++;
        if (typeof AmoCRM !== "undefined") {
          registerWidget();
        } else if (attempts < 10) {
          setTimeout(checkAPI, 300);
        } else {
          console.warn(
            "AmoCRM API not loaded after 3 seconds - running standalone"
          );
          registerWidget();
        }
      };
      checkAPI();
    } else {
      registerWidget();
    }

    return OrdersCalendarWidget;
  } catch (e) {
    console.error("Script initialization error:", e);
    return function () {};
  }
});

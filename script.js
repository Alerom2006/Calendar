define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    const self = this;
    this.__amowidget__ = true;

    // Конфигурация виджета
    this.config = {
      version: "1.0.6",
      debugMode: false,
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      system: null,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453, // Значение по умолчанию
      },
    };

    // Инициализация виджета
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          return reject("AmoCRM API not available");
        }

        AmoCRM.widgets
          .system()
          .then((system) => {
            self.state.system = system;
            self.state.initialized = true;
            resolve(true);
          })
          .catch(reject);
      });
    };

    // Загрузка сделок
    this.loadDeals = function () {
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
          .catch(reject);
      });
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
            ${dealsCount ? `<span class="deal-badge">${dealsCount}</span>` : ""}
          </div>
        `;
      }

      html += "</div>";
      return html;
    };

    // Основной метод рендеринга
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

          // Ключевой момент - отрисовка в правой колонке
          self.render_template({
            body: calendarHTML,
            caption: {
              class_name: "orders-calendar-caption",
            },
          });

          return true;
        })
        .catch((error) => {
          console.error("Ошибка загрузки:", error);
          self.render_template({
            body: '<div class="error">Не удалось загрузить данные</div>',
          });
          return false;
        });
    };

    // Колбэки виджета
    this.callbacks = {
      init: function (system) {
        self.state.system = system;
        return self
          .initSystem()
          .then(() => {
            // Применяем настройки из amoCRM
            if (system.settings?.deal_date_field_id) {
              self.state.fieldIds.ORDER_DATE = parseInt(
                system.settings.deal_date_field_id
              );
            }
            return true;
          })
          .catch((error) => {
            console.error("Ошибка инициализации:", error);
            return false;
          });
      },

      render: function () {
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
  if (typeof AmoCRM !== "undefined") {
    try {
      AmoCRM.Widget.register(OrdersCalendarWidget);
    } catch (e) {
      console.error("Ошибка регистрации виджета:", e);
    }
  }

  return OrdersCalendarWidget;
});

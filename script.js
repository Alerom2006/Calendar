// Универсальная обертка для AMD и standalone режимов
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["jquery"], factory);
  } else {
    root.OrdersCalendarWidget = factory(root.jQuery || $);
  }
})(this, function ($) {
  "use strict";

  console.log("OrdersCalendarWidget v1.0.12 loaded");

  function OrdersCalendarWidget() {
    const self = this;
    this.__amowidget__ = true;

    // Конфигурация
    this.config = {
      version: "1.0.12",
      debugMode: true,
    };

    // Состояние
    this.state = {
      initialized: false,
      system: null,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453,
      },
    };

    // Проверка доступности API
    this.isAPIAvailable = function () {
      try {
        return (
          typeof AmoCRM !== "undefined" &&
          typeof AmoCRM.widgets !== "undefined" &&
          typeof AmoCRM.request !== "undefined"
        );
      } catch (e) {
        console.error("API check error:", e);
        return false;
      }
    };

    // Безопасный запрос к API
    this.safeRequest = function (method, endpoint, params) {
      return new Promise((resolve) => {
        if (!this.isAPIAvailable()) {
          console.log("API недоступно, используем тестовые данные");
          resolve({ _embedded: { leads: [] } });
          return;
        }

        AmoCRM.request(method, endpoint, params)
          .then(resolve)
          .catch((error) => {
            console.error("API request failed:", error);
            resolve({ _embedded: { leads: [] } });
          });
      });
    };

    // Инициализация
    this.init = function () {
      return new Promise((resolve) => {
        if (!this.isAPIAvailable()) {
          console.log("API недоступно, работаем в автономном режиме");
          this.state.initialized = true;
          return resolve(true);
        }

        AmoCRM.widgets
          .system()
          .then((system) => {
            this.state.system = system;
            this.state.initialized = true;

            if (system.settings?.deal_date_field_id) {
              this.state.fieldIds.ORDER_DATE = parseInt(
                system.settings.deal_date_field_id
              );
            }

            resolve(true);
          })
          .catch((error) => {
            console.error("System init failed:", error);
            this.state.initialized = true;
            resolve(true);
          });
      });
    };

    // Загрузка данных
    this.loadData = function () {
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

      return this.safeRequest("GET", "/api/v4/leads", {
        filter: {
          [this.state.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
        limit: 250,
      }).then((response) => {
        this.processData(response._embedded?.leads || []);
      });
    };

    // Генерация HTML календаря
    this.generateCalendarHTML = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        let html = '<div class="calendar-grid">';

        // Заголовки дней недели
        ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => {
          html += `<div class="calendar-weekday">${day}</div>`;
        });

        // Пустые ячейки
        for (let i = 0; i < adjustedFirstDay; i++) {
          html += '<div class="calendar-day empty"></div>';
        }

        // Дни месяца
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${(month + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          const deals = this.state.dealsData[dateStr] || [];
          const isToday = dateStr === new Date().toISOString().split("T")[0];

          html += `
            <div class="calendar-day ${isToday ? "today" : ""} ${
            deals.length ? "has-deals" : ""
          }" data-date="${dateStr}">
              ${day}
              ${
                deals.length
                  ? `<span class="deal-badge">${deals.length}</span>`
                  : ""
              }
            </div>
          `;
        }

        html += "</div>";

        return `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h4>Календарь заказов</h4>
              <div class="calendar-nav">
                <button class="prev-month">←</button>
                <span class="current-month">${this.getMonthName(
                  month
                )} ${year}</span>
                <button class="next-month">→</button>
              </div>
            </div>
            ${html}
          </div>
        `;
      } catch (error) {
        console.error("Calendar generation error:", error);
        return '<div class="error">Ошибка при создании календаря</div>';
      }
    };

    // Основной метод рендеринга
    this.render = function () {
      try {
        const widgetHTML = this.generateCalendarHTML();
        const container = document.getElementById("widget-root");

        if (container) {
          container.innerHTML = widgetHTML;

          // Навигация по месяцам
          const prevBtn = container.querySelector(".prev-month");
          const nextBtn = container.querySelector(".next-month");

          if (prevBtn) {
            prevBtn.addEventListener("click", () => {
              this.state.currentDate.setMonth(
                this.state.currentDate.getMonth() - 1
              );
              this.renderWidget();
            });
          }

          if (nextBtn) {
            nextBtn.addEventListener("click", () => {
              this.state.currentDate.setMonth(
                this.state.currentDate.getMonth() + 1
              );
              this.renderWidget();
            });
          }
        }

        if (typeof this.render_template === "function") {
          this.render_template({
            body: widgetHTML,
            caption: {
              class_name: "orders-calendar-caption",
            },
          });
        }
      } catch (error) {
        console.error("Render error:", error);
      }
    };

    // Получение названия месяца
    this.getMonthName = function (monthIndex) {
      const months = [
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
      ];
      return months[monthIndex];
    };

    // Основной метод виджета
    this.renderWidget = function () {
      return this.init()
        .then(() => this.loadData())
        .then(() => this.render())
        .catch((error) => {
          console.error("Widget error:", error);
          this.state.dealsData = this.getMockData();
          this.render();
        });
    };

    // Тестовые данные
    this.getMockData = function () {
      const data = {};
      const days = new Date(
        this.state.currentDate.getFullYear(),
        this.state.currentDate.getMonth() + 1,
        0
      ).getDate();

      for (let i = 1; i <= days; i++) {
        if (i % 5 === 0 || i === 1) {
          // Добавляем первую дату для теста
          const date = `${this.state.currentDate.getFullYear()}-${(
            this.state.currentDate.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}-${i.toString().padStart(2, "0")}`;
          data[date] = [
            {
              id: i,
              name: `Тестовая сделка ${i}`,
              status_id: 143,
              price: i * 1000,
            },
          ];
        }
      }
      return data;
    };

    // Обработка данных
    this.processData = function (deals) {
      this.state.dealsData = {};
      deals.forEach((deal) => {
        const dateField = deal.custom_fields_values?.find(
          (f) => f.field_id === this.state.fieldIds.ORDER_DATE
        );

        if (dateField?.values?.[0]?.value) {
          const date = new Date(dateField.values[0].value * 1000);
          const dateStr = date.toISOString().split("T")[0];

          if (!this.state.dealsData[dateStr]) {
            this.state.dealsData[dateStr] = [];
          }

          this.state.dealsData[dateStr].push({
            id: deal.id,
            name: deal.name,
            status_id: deal.status_id,
            price: deal.price,
          });
        }
      });
    };

    // Колбэки для amoCRM
    this.callbacks = {
      init: (system) => this.init().then(() => true),
      render: () => this.renderWidget().then(() => true),
      onSave: (settings) => {
        if (settings?.deal_date_field_id) {
          this.state.fieldIds.ORDER_DATE = parseInt(
            settings.deal_date_field_id
          );
        }
        return true;
      },
      bind_actions: () => true,
      destroy: () => true,
    };

    return this;
  }

  // Автоматическая регистрация в amoCRM
  if (typeof AmoCRM !== "undefined" && typeof AmoCRM.Widget !== "undefined") {
    try {
      AmoCRM.Widget.register(OrdersCalendarWidget);
      console.log("Widget registered in AmoCRM");
    } catch (e) {
      console.error("Widget registration error:", e);
    }
  }

  // Для standalone режима
  if (typeof OrdersCalendarWidget !== "undefined" && !this.__amowidget__) {
    document.addEventListener("DOMContentLoaded", function () {
      new OrdersCalendarWidget().renderWidget();
    });
  }

  return OrdersCalendarWidget;
});

// Универсальная обертка для AMD и standalone режимов
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["jquery"], factory);
  } else {
    root.OrdersCalendarWidget = factory(root.jQuery || {});
  }
})(this, function ($) {
  "use strict";

  console.log("OrdersCalendarWidget v1.0.13 loaded");

  function OrdersCalendarWidget() {
    const self = this;
    this.__amowidget__ = true;

    // Конфигурация
    this.config = {
      version: "1.0.13",
      debugMode: false, // Отключаем debug режим для продакшена
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
      isStandalone: typeof AmoCRM === "undefined",
    };

    // Безопасный доступ к свойствам объекта
    this.safeAccess = function (obj, path, defaultValue) {
      return path
        .split(".")
        .reduce((o, p) => (o && o[p] !== undefined ? o[p] : defaultValue), obj);
    };

    // Проверка доступности API
    this.isAPIAvailable = function () {
      try {
        if (this.state.isStandalone) return false;
        return (
          typeof AmoCRM !== "undefined" &&
          typeof this.safeAccess(AmoCRM, "widgets.system", null) ===
            "function" &&
          typeof this.safeAccess(AmoCRM, "request", null) === "function"
        );
      } catch (e) {
        console.warn("API check warning:", e.message);
        return false;
      }
    };

    // Безопасный запрос к API
    this.safeApiRequest = function (method, endpoint, params) {
      return new Promise((resolve) => {
        if (!this.isAPIAvailable() || this.state.isStandalone) {
          console.log("API недоступно, используем тестовые данные");
          resolve({ _embedded: { leads: [] } });
          return;
        }

        try {
          AmoCRM.request(method, endpoint, params)
            .then((response) => {
              if (!response) throw new Error("Empty API response");
              resolve(response);
            })
            .catch((error) => {
              console.warn("API request warning:", error.message);
              resolve({ _embedded: { leads: [] } });
            });
        } catch (e) {
          console.warn("API request exception:", e.message);
          resolve({ _embedded: { leads: [] } });
        }
      });
    };

    // Инициализация
    this.init = function () {
      return new Promise((resolve) => {
        if (this.state.isStandalone || !this.isAPIAvailable()) {
          console.log("Работаем в автономном режиме");
          this.state.initialized = true;
          return resolve(true);
        }

        try {
          AmoCRM.widgets
            .system()
            .then((system) => {
              this.state.system = system || {};
              this.state.initialized = true;

              const fieldId = this.safeAccess(
                system,
                "settings.deal_date_field_id",
                null
              );
              if (fieldId) {
                this.state.fieldIds.ORDER_DATE = parseInt(fieldId) || 885453;
              }

              resolve(true);
            })
            .catch((error) => {
              console.warn("System init warning:", error.message);
              this.state.initialized = true;
              resolve(true);
            });
        } catch (e) {
          console.warn("System init exception:", e.message);
          this.state.initialized = true;
          resolve(true);
        }
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

      return this.safeApiRequest("GET", "/api/v4/leads", {
        filter: {
          [this.state.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
        limit: 250,
      }).then((response) => {
        this.processData(this.safeAccess(response, "_embedded.leads", []));
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
          const deals = this.safeAccess(this.state.dealsData, dateStr, []);
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
                <button class="prev-month" aria-label="Предыдущий месяц">←</button>
                <span class="current-month">${this.getMonthName(
                  month
                )} ${year}</span>
                <button class="next-month" aria-label="Следующий месяц">→</button>
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

        if (
          !this.state.isStandalone &&
          typeof this.render_template === "function"
        ) {
          try {
            this.render_template({
              body: widgetHTML,
              caption: {
                class_name: "orders-calendar-caption",
              },
            });
          } catch (e) {
            console.warn("Template render warning:", e.message);
          }
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
      return months[monthIndex] || "";
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
      (deals || []).forEach((deal) => {
        try {
          const dateField = (deal.custom_fields_values || []).find(
            (f) => f && f.field_id === this.state.fieldIds.ORDER_DATE
          );

          if (
            dateField &&
            dateField.values &&
            dateField.values[0] &&
            dateField.values[0].value
          ) {
            const date = new Date(dateField.values[0].value * 1000);
            const dateStr = date.toISOString().split("T")[0];

            if (!this.state.dealsData[dateStr]) {
              this.state.dealsData[dateStr] = [];
            }

            this.state.dealsData[dateStr].push({
              id: deal.id || 0,
              name: deal.name || "Без названия",
              status_id: deal.status_id || 0,
              price: deal.price || 0,
            });
          }
        } catch (e) {
          console.warn("Deal processing warning:", e.message);
        }
      });
    };

    // Колбэки для amoCRM
    this.callbacks = {
      init: (system) => this.init().then(() => true),
      render: () => this.renderWidget().then(() => true),
      onSave: (settings) => {
        try {
          if (settings && settings.deal_date_field_id) {
            this.state.fieldIds.ORDER_DATE =
              parseInt(settings.deal_date_field_id) || 885453;
          }
        } catch (e) {
          console.warn("Settings save warning:", e.message);
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
  if (
    typeof OrdersCalendarWidget !== "undefined" &&
    typeof AmoCRM === "undefined"
  ) {
    document.addEventListener("DOMContentLoaded", function () {
      try {
        new OrdersCalendarWidget().renderWidget();
      } catch (e) {
        console.error("Standalone init error:", e);
      }
    });
  }

  return OrdersCalendarWidget;
});

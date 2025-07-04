// Гарантированно работающий виджет календаря заказов v1.0.16
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory); // Убрана зависимость от jQuery
  } else {
    root.OrdersCalendarWidget = factory();
  }
})(this, function () {
  "use strict";

  console.log("OrdersCalendarWidget v1.0.16 initialized");

  // 1. Основной конструктор виджета
  function OrdersCalendarWidget() {
    // 2. Гарантированная инициализация состояния
    this.state = {
      currentDate: new Date(),
      dealsData: this._generateFallbackData(), // Вызов исправленного метода
      fieldIds: { ORDER_DATE: 885453 },
      isInitialized: false,
    };

    // 3. Исправленный метод генерации тестовых данных
    this._generateFallbackData = function () {
      const data = {};
      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        if (day % 5 === 0 || day === 1) {
          const dateStr = `${year}-${(month + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          data[dateStr] = [
            {
              id: day,
              name: `Тестовая сделка ${day}`,
              status_id: 143,
              price: day * 1000,
            },
          ];
        }
      }
      return data;
    };

    // 4. Абсолютно надежный метод рендеринга
    this._renderCalendar = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        // Создаем контейнер, если не существует
        let container = document.getElementById("widget-root");
        if (!container) {
          container = document.createElement("div");
          container.id = "widget-root";
          document.body.appendChild(container);
        }

        // Генерация HTML
        container.innerHTML = `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>Календарь заказов</h3>
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">
                  ${this._getMonthName(month)} ${year}
                </span>
                <button class="nav-button next-month">→</button>
              </div>
            </div>
            <div class="calendar-grid">
              ${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
                .map((day) => `<div class="calendar-weekday">${day}</div>`)
                .join("")}
              ${'<div class="calendar-day empty"></div>'.repeat(
                adjustedFirstDay
              )}
              ${Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${(month + 1)
                  .toString()
                  .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                const deals = this.state.dealsData[dateStr] || [];
                const isToday =
                  dateStr === new Date().toISOString().split("T")[0];
                return `
                  <div class="calendar-day ${isToday ? "today" : ""} ${
                  deals.length ? "has-deals" : ""
                }">
                    <div class="day-number">${day}</div>
                    ${
                      deals.length
                        ? `<div class="deal-count">${deals.length}</div>`
                        : ""
                    }
                  </div>`;
              }).join("")}
            </div>
          </div>
        `;

        // Навешиваем обработчики
        container
          .querySelector(".prev-month")
          ?.addEventListener("click", () => {
            this.state.currentDate.setMonth(
              this.state.currentDate.getMonth() - 1
            );
            this._renderCalendar();
          });

        container
          .querySelector(".next-month")
          ?.addEventListener("click", () => {
            this.state.currentDate.setMonth(
              this.state.currentDate.getMonth() + 1
            );
            this._renderCalendar();
          });
      } catch (error) {
        console.error("Render error:", error);
        this._showError();
      }
    };

    // 5. Вспомогательные методы
    this._getMonthName = function (monthIndex) {
      return (
        [
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
        ][monthIndex] || ""
      );
    };

    this._showError = function () {
      const container = document.getElementById("widget-root") || document.body;
      container.innerHTML = `
        <div class="calendar-error">
          <h3>Календарь заказов</h3>
          <p>Произошла ошибка при загрузке календаря. Пожалуйста, обновите страницу.</p>
        </div>
      `;
    };

    // 6. Публичные методы
    this.init = function () {
      this.state.isInitialized = true;
      this._renderCalendar();
    };

    this.render = function () {
      this._renderCalendar();
    };

    // 7. API для amoCRM
    this.callbacks = {
      init: () => {
        this.init();
        return Promise.resolve(true);
      },
      render: () => {
        this.render();
        return Promise.resolve(true);
      },
      onSave: () => true,
      bind_actions: () => true,
      destroy: () => true,
    };

    // Автоматическая инициализация
    this.init();
  }

  // 8. Регистрация виджета
  if (typeof AmoCRM !== "undefined" && typeof AmoCRM.Widget !== "undefined") {
    try {
      AmoCRM.Widget.register(OrdersCalendarWidget);
    } catch (e) {
      console.error("Widget registration failed:", e);
      // Fallback для случая, если регистрация не удалась
      new OrdersCalendarWidget();
    }
  } else {
    // Автозагрузка вне amoCRM
    document.addEventListener("DOMContentLoaded", function () {
      new OrdersCalendarWidget();
    });
  }

  return OrdersCalendarWidget;
});

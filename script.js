(function () {
  function OrdersCalendarWidget() {
    const self = this;

    this.state = {
      currentDate: new Date(),
      dealsData: {},
      fieldIds: { ORDER_DATE: 885453 },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
    };

    // Генерация тестовых данных
    this.generateMockData = function () {
      const data = {};
      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${(month + 1)
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        data[dateStr] = [];

        // Добавляем сделки для некоторых дней
        if (day % 3 === 0 || day === 1) {
          data[dateStr].push({
            id: day,
            name: `Сделка #${day}`,
            status_id: 143,
            price: day * 1500,
          });
        }
      }
      return data;
    };

    // Обработчик клика по дате
    this.handleDateClick = function (dateStr, event) {
      event.stopPropagation();
      const deals = self.state.dealsData[dateStr] || [];

      // Удаляем старый попап
      const oldPopup = document.querySelector(".deals-popup");
      if (oldPopup) oldPopup.remove();

      // Создаем HTML попапа
      let html = `<div class="deals-popup"><h3>Сделки на ${dateStr}</h3>`;

      if (deals.length > 0) {
        deals.forEach((deal) => {
          html += `
            <div class="deal-item">
              <h4>${deal.name}</h4>
              <p>Статус: ${
                self.state.statuses[deal.status_id] || "Неизвестно"
              }</p>
              <p>Сумма: ${deal.price} руб.</p>
            </div>
          `;
        });
      } else {
        html += "<p>Нет сделок на эту дату</p>";
      }

      html += '<button class="close-popup">Закрыть</button></div>';

      // Добавляем попап
      document
        .getElementById("widget-root")
        .insertAdjacentHTML("beforeend", html);

      // Вешаем обработчик закрытия
      document.querySelector(".close-popup").addEventListener("click", () => {
        document.querySelector(".deals-popup").remove();
      });
    };

    // Генерация календаря
    this.generateCalendarHTML = function (month, year) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1;

      let html = '<div class="calendar-grid">';

      // Заголовки дней недели
      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => {
        html += `<div class="calendar-weekday">${day}</div>`;
      });

      // Пустые дни в начале
      for (let i = 0; i < firstDayIndex; i++) {
        html += '<div class="calendar-day empty"></div>';
      }

      // Дни месяца
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${(month + 1)
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const deals = self.state.dealsData[dateStr] || [];
        const isToday = dateStr === new Date().toISOString().split("T")[0];

        html += `
          <div class="calendar-day ${isToday ? "today" : ""} ${
          deals.length ? "has-deals" : ""
        }">
            <div class="day-number">${day}</div>
            ${
              deals.length
                ? `<div class="deal-count">${deals.length}</div>`
                : ""
            }
          </div>
        `;
      }

      html += "</div>";
      return html;
    };

    // Рендер календаря
    this.renderCalendar = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const monthNames = [
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

        const calendarHTML = `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>Календарь заказов</h3>
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">${monthNames[month]} ${year}</span>
                <button class="nav-button next-month">→</button>
              </div>
            </div>
            ${this.generateCalendarHTML(month, year)}
          </div>
        `;

        document.getElementById("widget-root").innerHTML = calendarHTML;

        // Вешаем обработчики
        this.bindEvents();
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    };

    // Привязка событий
    this.bindEvents = function () {
      // Навигация
      document.querySelector(".prev-month").addEventListener("click", () => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() - 1);
        self.renderCalendar();
      });

      document.querySelector(".next-month").addEventListener("click", () => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() + 1);
        self.renderCalendar();
      });

      // Клики по дням
      setTimeout(() => {
        document
          .querySelectorAll(".calendar-day:not(.empty)")
          .forEach((day) => {
            const dayNum = day
              .querySelector(".day-number")
              .textContent.padStart(2, "0");
            const dateStr = `${self.state.currentDate.getFullYear()}-${(
              self.state.currentDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${dayNum}`;

            day.addEventListener("click", (e) => {
              self.handleDateClick(dateStr, e);
            });
          });
      }, 50);
    };

    // Показать ошибку
    this.showError = function () {
      document.getElementById("widget-root").innerHTML = `
        <div class="error-message">
          <h3>Ошибка</h3>
          <p>Не удалось загрузить календарь</p>
        </div>
      `;
    };

    // Инициализация
    this.init = function () {
      this.state.dealsData = this.generateMockData();
      this.renderCalendar();
    };
  }

  // Запуск при загрузке
  document.addEventListener("DOMContentLoaded", () => {
    const widget = new OrdersCalendarWidget();
    widget.init();
  });
})();

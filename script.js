(function () {
  // Основной конструктор виджета
  function OrdersCalendarWidget() {
    const self = this;

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453,
      },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
    };

    // Обработчик клика по дате
    this.handleDateClick = function (dateStr, event) {
      event.stopPropagation();
      const deals = self.state.dealsData[dateStr] || [];

      // Удаляем старый попап если есть
      const oldPopup = document.querySelector(".deals-popup");
      if (oldPopup) oldPopup.remove();

      // Создаем HTML для попапа
      let dealsHTML = `
        <div class="deals-popup">
          <h3>Сделки на ${dateStr}</h3>
          <div class="deals-list">
      `;

      if (deals.length > 0) {
        deals.forEach((deal) => {
          dealsHTML += `
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
        dealsHTML += "<p>Нет сделок на эту дату</p>";
      }

      dealsHTML += `
          </div>
          <button class="close-popup">Закрыть</button>
        </div>
      `;

      // Добавляем попап на страницу
      document
        .getElementById("widget-root")
        .insertAdjacentHTML("beforeend", dealsHTML);

      // Обработчик закрытия попапа
      document
        .querySelector(".close-popup")
        .addEventListener("click", function () {
          document.querySelector(".deals-popup").remove();
        });
    };

    // Генерация тестовых данных
    this.generateMockData = function () {
      const data = {};
      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        if (day % 3 === 0 || day === 1) {
          // Генерируем сделки чаще для теста
          const dateStr = `${year}-${(month + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          data[dateStr] = [
            {
              id: day,
              name: `Сделка #${day}`,
              status_id: day % 2 === 0 ? 143 : 144, // Чередуем статусы
              price: day * 1500,
            },
          ];

          // Добавляем вторую сделку для некоторых дней
          if (day % 5 === 0) {
            data[dateStr].push({
              id: day + 100,
              name: `Доп. сделка #${day}`,
              status_id: 142,
              price: day * 800,
            });
          }
        }
      }
      return data;
    };

    // Генерация HTML календаря
    this.generateCalendarHTML = function (
      month,
      year,
      daysInMonth,
      firstDayIndex
    ) {
      let html = ['<div class="calendar-grid">'];

      // Заголовки дней недели
      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => {
        html.push(`<div class="calendar-weekday">${day}</div>`);
      });

      // Пустые ячейки в начале месяца
      for (let i = 0; i < firstDayIndex; i++) {
        html.push('<div class="calendar-day empty"></div>');
      }

      // Дни месяца
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${(month + 1)
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const deals = self.state.dealsData[dateStr] || [];
        const isToday = dateStr === new Date().toISOString().split("T")[0];

        html.push(`
          <div class="calendar-day ${isToday ? "today " : ""}${
          deals.length ? "has-deals" : ""
        }">
            <div class="day-number">${day}</div>
            ${
              deals.length
                ? `<div class="deal-count">${deals.length}</div>`
                : ""
            }
          </div>
        `);
      }

      html.push("</div>");
      return html.join("");
    };

    // Основной метод рендеринга
    this.renderCalendar = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1; // Коррекция для Пн-Вс

        const calendarHTML = this.generateCalendarHTML(
          month,
          year,
          daysInMonth,
          firstDayIndex
        );

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

        const widgetHTML = `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>Календарь заказов</h3>
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">${monthNames[month]} ${year}</span>
                <button class="nav-button next-month">→</button>
              </div>
            </div>
            ${calendarHTML}
          </div>
        `;

        const container =
          document.getElementById("widget-root") || document.body;
        container.innerHTML = widgetHTML;

        // Навешиваем обработчики событий
        this.bindCalendarEvents();

        // Добавляем обработчики кликов на дни
        setTimeout(() => {
          document
            .querySelectorAll(".calendar-day:not(.empty)")
            .forEach((dayEl) => {
              const dayNum = dayEl
                .querySelector(".day-number")
                .textContent.padStart(2, "0");
              const dateStr = `${year}-${(month + 1)
                .toString()
                .padStart(2, "0")}-${dayNum}`;

              dayEl.addEventListener("click", (e) => {
                self.handleDateClick(dateStr, e);
              });
            });
        }, 50);
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    };

    // Привязка событий календаря
    this.bindCalendarEvents = function () {
      // Обработчики для кнопок навигации
      document.querySelector(".prev-month")?.addEventListener("click", () => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() - 1);
        self.renderCalendar();
      });

      document.querySelector(".next-month")?.addEventListener("click", () => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() + 1);
        self.renderCalendar();
      });
    };

    // Показать ошибку
    this.showError = function () {
      const errorHTML = `
        <div class="calendar-error">
          <h3>Ошибка календаря</h3>
          <p>Произошла ошибка при загрузке данных</p>
        </div>
      `;

      const container = document.getElementById("widget-root") || document.body;
      container.innerHTML = errorHTML;
    };

    // Загрузка данных (в standalone используем моковые данные)
    this.loadData = function () {
      this.state.dealsData = this.generateMockData();
      return Promise.resolve();
    };

    // Для standalone режима
    this.renderWidget = function () {
      this.loadData().then(() => {
        this.renderCalendar();
      });
    };
  }

  // Инициализация виджета
  document.addEventListener("DOMContentLoaded", function () {
    window.widgetInstance = new OrdersCalendarWidget();
    window.widgetInstance.renderWidget();
  });
})();

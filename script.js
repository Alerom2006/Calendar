(function () {
  // Проверяем окружение
  const isAMD = typeof define === "function" && define.amd;
  const isStandalone = typeof window !== "undefined";

  class OrdersCalendarWidget {
    constructor() {
      this.state = {
        initialized: false,
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

      // Автобайндинг методов
      this.handleDateClick = this.handleDateClick.bind(this);
      this.handleMonthNavigation = this.handleMonthNavigation.bind(this);
    }

    // Обработчик клика по дате
    handleDateClick(dateStr, event) {
      event.stopPropagation();

      if (typeof AmoCRM !== "undefined") {
        AmoCRM.router.navigate({
          leads: {
            filter: {
              [this.state.fieldIds.ORDER_DATE]: {
                from: Math.floor(new Date(dateStr).getTime() / 1000),
                to: Math.floor(new Date(dateStr).getTime() / 1000 + 86399),
              },
            },
          },
        });
      } else {
        this.showDealsPopup(dateStr);
      }
    }

    // Показ попапа со сделками
    showDealsPopup(dateStr) {
      const deals = this.state.dealsData[dateStr] || [];
      let dealsHTML = `
        <div class="deals-popup">
          <h3>Сделки на ${dateStr}</h3>
      `;

      if (deals.length) {
        dealsHTML += deals
          .map(
            (deal) => `
          <div class="deal-item">
            <h4>${deal.name}</h4>
            <p>Статус: ${
              this.state.statuses[deal.status_id] || "Неизвестно"
            }</p>
            <p>Сумма: ${deal.price} руб.</p>
          </div>
        `
          )
          .join("");
      } else {
        dealsHTML += "<p>Нет сделок на эту дату</p>";
      }

      dealsHTML += '<button class="close-popup">Закрыть</button></div>';

      // Удаляем старый попап если есть
      const oldPopup = document.querySelector(".deals-popup");
      if (oldPopup) oldPopup.remove();

      // Добавляем новый попап
      const widgetRoot = document.getElementById("widget-root");
      widgetRoot.insertAdjacentHTML("beforeend", dealsHTML);

      // Обработчик закрытия попапа
      widgetRoot.querySelector(".close-popup").addEventListener("click", () => {
        widgetRoot.querySelector(".deals-popup").remove();
      });
    }

    // Генерация тестовых данных
    generateMockData() {
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
    }

    // Генерация HTML календаря
    generateCalendarHTML(month, year, daysInMonth, adjustedFirstDay) {
      const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
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

      let html = ['<div class="calendar-grid">'];

      // Заголовки дней недели
      html.push(
        ...weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`)
      );

      // Пустые ячейки
      html.push(
        ...Array(adjustedFirstDay).fill(
          '<div class="calendar-day empty"></div>'
        )
      );

      // Дни месяца
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${(month + 1)
          .toString()
          .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        const deals = this.state.dealsData[dateStr] || [];
        const isToday = dateStr === new Date().toISOString().split("T")[0];
        const classes = [
          "calendar-day",
          isToday ? "today" : "",
          deals.length ? "has-deals" : "",
        ]
          .filter(Boolean)
          .join(" ");

        html.push(`
          <div class="${classes}" data-date="${dateStr}">
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
    }

    // Обработчик навигации по месяцам
    handleMonthNavigation(direction) {
      this.state.currentDate.setMonth(
        this.state.currentDate.getMonth() + (direction === "prev" ? -1 : 1)
      );
      this.renderCalendar();
    }

    // Привязка событий календаря
    bindCalendarEvents() {
      // Навигация по месяцам
      document
        .querySelector(".prev-month")
        ?.addEventListener("click", () => this.handleMonthNavigation("prev"));

      document
        .querySelector(".next-month")
        ?.addEventListener("click", () => this.handleMonthNavigation("next"));

      // Клики по дням
      document.querySelectorAll(".calendar-day:not(.empty)").forEach((day) => {
        day.addEventListener("click", (e) => {
          const dateStr = day.dataset.date;
          if (dateStr) this.handleDateClick(dateStr, e);
        });
      });
    }

    // Основной метод рендеринга
    renderCalendar() {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const calendarHTML = this.generateCalendarHTML(
          month,
          year,
          daysInMonth,
          adjustedFirstDay
        );

        const templateData = {
          title: "Календарь заказов",
          month: [
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
          ][month],
          year: year,
          calendar: calendarHTML,
        };

        // Режим amoCRM
        if (typeof this.render === "function") {
          this.render({
            data: `
              <div class="orders-calendar">
                <div class="calendar-header">
                  <h3>${templateData.title}</h3>
                  <div class="month-navigation">
                    <button class="nav-button prev-month">←</button>
                    <span class="current-month">${templateData.month} ${templateData.year}</span>
                    <button class="nav-button next-month">→</button>
                  </div>
                </div>
                ${templateData.calendar}
              </div>
            `,
            load: (template) => {
              template.render(templateData);
              this.bindCalendarEvents();
            },
          });
        }
        // Standalone режим
        else {
          const container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = `
            <div class="orders-calendar">
              <div class="calendar-header">
                <h3>${templateData.title}</h3>
                <div class="month-navigation">
                  <button class="nav-button prev-month">←</button>
                  <span class="current-month">${templateData.month} ${templateData.year}</span>
                  <button class="nav-button next-month">→</button>
                </div>
              </div>
              ${templateData.calendar}
            </div>
          `;
          this.bindCalendarEvents();
        }
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    }

    // Показать ошибку
    showError() {
      const errorHTML = `
        <div class="calendar-error">
          <h3>Календарь заказов</h3>
          <p>Произошла ошибка при загрузке календаря</p>
        </div>
      `;

      const container = document.getElementById("widget-root") || document.body;
      container.innerHTML = errorHTML;
    }

    // Загрузка данных
    async loadData() {
      if (typeof AmoCRM === "undefined" || !AmoCRM.request) {
        this.state.dealsData = this.generateMockData();
        return;
      }

      try {
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

        const response = await AmoCRM.request("GET", "/api/v4/leads", {
          filter: {
            [this.state.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
          limit: 250,
        });

        if (response?._embedded?.leads) {
          this.processData(response._embedded.leads);
        } else {
          this.state.dealsData = this.generateMockData();
        }
      } catch (error) {
        console.warn("Ошибка загрузки данных:", error);
        this.state.dealsData = this.generateMockData();
      }
    }

    // Обработка данных сделок
    processData(deals) {
      this.state.dealsData = {};

      deals.forEach((deal) => {
        try {
          const dateField = deal.custom_fields_values?.find(
            (f) => f?.field_id === this.state.fieldIds.ORDER_DATE
          );

          const timestamp = dateField?.values?.[0]?.value;
          if (!timestamp) return;

          const date = new Date(timestamp * 1000);
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
        } catch (e) {
          console.warn("Ошибка обработки сделки:", e);
        }
      });
    }

    // Для standalone режима
    async renderWidget() {
      await this.loadData();
      this.renderCalendar();
    }
  }

  // Экспорт в зависимости от окружения
  if (isAMD) {
    define([], () => OrdersCalendarWidget);
  }
  if (isStandalone) {
    window.OrdersCalendarWidget = OrdersCalendarWidget;
    window.widgetInstance = new OrdersCalendarWidget();

    document.addEventListener("DOMContentLoaded", () => {
      if (typeof OrdersCalendarWidget !== "undefined") {
        window.widgetInstance.renderWidget();
      }
    });
  }
})();

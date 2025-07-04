(function () {
  "use strict"; // Добавляем строгий режим для избежания скрытых ошибок

  // Проверяем окружение
  const isAMD = typeof define === "function" && define.amd;
  const isStandalone = !isAMD && typeof window !== "undefined";

  // Используем старый синтаксис класса для совместимости
  function OrdersCalendarWidget() {
    if (!(this instanceof OrdersCalendarWidget)) {
      return new OrdersCalendarWidget();
    }

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

  // Методы прототипа
  OrdersCalendarWidget.prototype = {
    constructor: OrdersCalendarWidget,

    // Обработчик клика по дате
    handleDateClick: function (dateStr, event) {
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
    },

    // Показ попапа со сделками
    showDealsPopup: function (dateStr) {
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

      const oldPopup = document.querySelector(".deals-popup");
      if (oldPopup) oldPopup.remove();

      const widgetRoot = document.getElementById("widget-root");
      widgetRoot.insertAdjacentHTML("beforeend", dealsHTML);

      widgetRoot.querySelector(".close-popup").addEventListener("click", () => {
        widgetRoot.querySelector(".deals-popup").remove();
      });
    },

    // Генерация тестовых данных
    generateMockData: function () {
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
    },

    // Основной метод рендеринга
    renderCalendar: function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const calendarHTML = this._generateCalendarHTML(
          month,
          year,
          daysInMonth,
          adjustedFirstDay
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

        const template = `
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

        if (typeof this.render === "function") {
          this.render({
            data: template,
            load: (tpl) => {
              tpl.render({});
              this._bindCalendarEvents();
            },
          });
        } else {
          const container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = template;
          this._bindCalendarEvents();
        }
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    },

    // Приватные методы
    _generateCalendarHTML: function (
      month,
      year,
      daysInMonth,
      adjustedFirstDay
    ) {
      const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
      let html = ['<div class="calendar-grid">'];

      html.push(
        ...weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`)
      );
      html.push(
        ...Array(adjustedFirstDay).fill(
          '<div class="calendar-day empty"></div>'
        )
      );

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

      return html.join("") + "</div>";
    },

    _bindCalendarEvents: function () {
      const prevBtn = document.querySelector(".prev-month");
      const nextBtn = document.querySelector(".next-month");

      if (prevBtn)
        prevBtn.addEventListener("click", () => this._changeMonth(-1));
      if (nextBtn)
        nextBtn.addEventListener("click", () => this._changeMonth(1));

      document.querySelectorAll(".calendar-day:not(.empty)").forEach((day) => {
        day.addEventListener("click", (e) => {
          const dateStr = day.dataset.date;
          if (dateStr) this.handleDateClick(dateStr, e);
        });
      });
    },

    _changeMonth: function (delta) {
      this.state.currentDate.setMonth(
        this.state.currentDate.getMonth() + delta
      );
      this.renderCalendar();
    },

    // Загрузка данных
    loadData: function () {
      if (typeof AmoCRM === "undefined" || !AmoCRM.request) {
        this.state.dealsData = this.generateMockData();
        return Promise.resolve();
      }

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

      return AmoCRM.request("GET", "/api/v4/leads", {
        filter: {
          [this.state.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
        limit: 250,
      })
        .then((response) => {
          if (response?._embedded?.leads) {
            this._processData(response._embedded.leads);
          } else {
            this.state.dealsData = this.generateMockData();
          }
        })
        .catch((error) => {
          console.warn("Ошибка загрузки данных:", error);
          this.state.dealsData = this.generateMockData();
        });
    },

    _processData: function (deals) {
      this.state.dealsData = {};
      deals.forEach((deal) => {
        try {
          const dateField = deal.custom_fields_values?.find(
            (f) => f?.field_id === this.state.fieldIds.ORDER_DATE
          );
          const timestamp = dateField?.values?.[0]?.value;
          if (!timestamp) return;

          const dateStr = new Date(timestamp * 1000)
            .toISOString()
            .split("T")[0];
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
    },

    // Для standalone режима
    renderWidget: function () {
      return this.loadData().then(() => this.renderCalendar());
    },

    // Функции обратного вызова для amoCRM
    callbacks: {
      init: function () {
        return Promise.resolve(true);
      },
      render: function () {
        return new OrdersCalendarWidget().renderWidget();
      },
      onSave: function (settings) {
        return true;
      },
      bind_actions: function () {
        return true;
      },
      destroy: function () {
        return true;
      },
    },
  };

  // Экспорт
  if (isAMD) {
    define([], () => OrdersCalendarWidget);
  } else if (isStandalone) {
    window.OrdersCalendarWidget = OrdersCalendarWidget;
    document.addEventListener("DOMContentLoaded", () => {
      new OrdersCalendarWidget().renderWidget();
    });
  }
})();

(function () {
  "use strict";

  // Проверяем окружение (AMD или standalone)
  const isAMD = typeof define === "function" && define.amd;
  const isStandalone = !isAMD && typeof window !== "undefined";

  // Основной конструктор виджета
  function OrdersCalendarWidget() {
    if (!(this instanceof OrdersCalendarWidget)) {
      return new OrdersCalendarWidget();
    }

    // Сохраняем контекст для использования в колбэках
    const self = this;

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453, // ID поля с датой заказа
      },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
    };

    // Привязываем контекст для методов
    this.handleDateClick = this.handleDateClick.bind(this);
    this.handleMonthNavigation = this.handleMonthNavigation.bind(this);

    // Метод инициализации виджета
    this.init = function () {
      return this.loadData()
        .then(() => this.renderCalendar())
        .catch((error) => {
          console.error("Ошибка инициализации:", error);
          this.showError();
        });
    };

    // Обработчик клика по дате в календаре
    this.handleDateClick = function (dateStr, event) {
      try {
        event.stopPropagation();

        if (typeof AmoCRM !== "undefined") {
          // В режиме amoCRM - навигация к сделкам с фильтром по дате
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
          // В standalone режиме - показываем попап со сделками
          this.showDealsPopup(dateStr);
        }
      } catch (error) {
        console.error("Ошибка обработки клика:", error);
      }
    };

    // Показ попапа со сделками на выбранную дату
    this.showDealsPopup = function (dateStr) {
      try {
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
        const widgetRoot =
          document.getElementById("widget-root") || document.body;
        widgetRoot.insertAdjacentHTML("beforeend", dealsHTML);

        // Обработчик закрытия попапа
        widgetRoot
          .querySelector(".close-popup")
          .addEventListener("click", () => {
            widgetRoot.querySelector(".deals-popup").remove();
          });
      } catch (error) {
        console.error("Ошибка показа попапа:", error);
      }
    };

    // Генерация HTML календаря
    this.generateCalendarHTML = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
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
        const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

        let html = ['<div class="calendar-grid">'];

        // Заголовки дней недели
        html.push(
          ...weekdays.map((day) => `<div class="calendar-weekday">${day}</div>`)
        );

        // Пустые ячейки в начале месяца
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

        return {
          html: html.join(""),
          title: "Календарь заказов",
          monthName: monthNames[month],
          year: year,
        };
      } catch (error) {
        console.error("Ошибка генерации календаря:", error);
        throw error;
      }
    };

    // Привязка событий календаря
    this.bindCalendarEvents = function () {
      try {
        // Навигация по месяцам
        document
          .querySelector(".prev-month")
          ?.addEventListener("click", () => this.handleMonthNavigation("prev"));

        document
          .querySelector(".next-month")
          ?.addEventListener("click", () => this.handleMonthNavigation("next"));

        // Клики по дням
        document
          .querySelectorAll(".calendar-day:not(.empty)")
          .forEach((day) => {
            day.addEventListener("click", (e) => {
              const dateStr = day.dataset.date;
              if (dateStr) this.handleDateClick(dateStr, e);
            });
          });
      } catch (error) {
        console.error("Ошибка привязки событий:", error);
      }
    };

    // Обработчик навигации по месяцам
    this.handleMonthNavigation = function (direction) {
      try {
        this.state.currentDate.setMonth(
          this.state.currentDate.getMonth() + (direction === "prev" ? -1 : 1)
        );
        this.renderCalendar();
      } catch (error) {
        console.error("Ошибка навигации:", error);
      }
    };

    // Основной метод рендеринга
    this.renderCalendar = function () {
      try {
        const calendarData = this.generateCalendarHTML();
        const template = `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>${calendarData.title}</h3>
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">${calendarData.monthName} ${calendarData.year}</span>
                <button class="nav-button next-month">→</button>
              </div>
            </div>
            ${calendarData.html}
          </div>
        `;

        if (typeof this.render === "function") {
          this.render({
            data: template,
            load: () => this.bindCalendarEvents(),
          });
        } else {
          const container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = template;
          this.bindCalendarEvents();
        }
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    };

    // Показать сообщение об ошибке
    this.showError = function () {
      const errorHTML = `
        <div class="calendar-error">
          <h3>Календарь заказов</h3>
          <p>Произошла ошибка при загрузке календаря</p>
        </div>
      `;

      const container = document.getElementById("widget-root") || document.body;
      container.innerHTML = errorHTML;
    };

    // Загрузка данных
    this.loadData = function () {
      return new Promise((resolve) => {
        try {
          if (typeof AmoCRM === "undefined" || !AmoCRM.request) {
            this.state.dealsData = this.generateMockData();
            return resolve();
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

          AmoCRM.request("GET", "/api/v4/leads", {
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
                this.processData(response._embedded.leads);
              } else {
                this.state.dealsData = this.generateMockData();
              }
              resolve();
            })
            .catch((error) => {
              console.warn("Ошибка загрузки данных:", error);
              this.state.dealsData = this.generateMockData();
              resolve();
            });
        } catch (error) {
          console.error("Ошибка загрузки данных:", error);
          this.state.dealsData = this.generateMockData();
          resolve();
        }
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

    // Обработка данных сделок
    this.processData = function (deals) {
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
    };

    // Применение настроек
    this.applySettings = function (settings) {
      try {
        if (settings.api_key) {
          this.state.apiKey = settings.api_key;
        }
        if (settings.account) {
          this.state.account = settings.account;
        }
        if (settings.deal_date_field_id) {
          this.state.fieldIds.ORDER_DATE = parseInt(
            settings.deal_date_field_id
          );
        }
        return true;
      } catch (error) {
        console.error("Ошибка применения настроек:", error);
        return false;
      }
    };

    // Функции обратного вызова для amoCRM
    this.callbacks = {
      init: function () {
        return new Promise((resolve) => {
          try {
            const widget = new OrdersCalendarWidget();
            window.widgetInstance = widget;
            resolve(true);
          } catch (error) {
            console.error("Ошибка инициализации:", error);
            resolve(false);
          }
        });
      },

      render: function () {
        return new Promise((resolve) => {
          try {
            if (window.widgetInstance) {
              window.widgetInstance.init().then(() => resolve(true));
            } else {
              new OrdersCalendarWidget().init().then(() => resolve(true));
            }
          } catch (error) {
            console.error("Ошибка рендеринга:", error);
            resolve(false);
          }
        });
      },

      onSave: function (settings) {
        try {
          if (self.applySettings) {
            return self.applySettings(settings);
          }
          return true;
        } catch (error) {
          console.error("Ошибка сохранения настроек:", error);
          return false;
        }
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

  // Экспорт в зависимости от окружения
  if (isAMD) {
    define([], () => OrdersCalendarWidget);
  } else if (isStandalone) {
    window.OrdersCalendarWidget = OrdersCalendarWidget;
    document.addEventListener("DOMContentLoaded", () => {
      new OrdersCalendarWidget().init();
    });
  }
})();

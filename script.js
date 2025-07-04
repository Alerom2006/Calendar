define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    var self = this;

    // Проверяем доступность API amoCRM
    this.isAMOCRM = typeof AmoCRM !== "undefined";

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      dealsData: {},
      fieldIds: { ORDER_DATE: 885453 },
    };

    // Генерация HTML календаря (оптимизированная версия)
    this.generateCalendarHTML = function () {
      var month = this.state.currentDate.getMonth();
      var year = this.state.currentDate.getFullYear();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var firstDay = new Date(year, month, 1).getDay();
      var adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

      var html = ['<div class="calendar-container">'];

      // Заголовок
      html.push(
        '<div class="calendar-header">',
        "<h3>Календарь заказов</h3>",
        '<div class="month-navigation">',
        '<button class="prev-month">←</button>',
        '<span class="current-month">',
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
        ][month],
        " ",
        year,
        "</span>",
        '<button class="next-month">→</button>',
        "</div>",
        "</div>",
        '<div class="calendar-grid">'
      );

      // Дни недели
      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => {
        html.push('<div class="weekday">' + day + "</div>");
      });

      // Пустые ячейки
      for (var i = 0; i < adjustedFirstDay; i++) {
        html.push('<div class="day empty"></div>');
      }

      // Дни месяца
      for (var day = 1; day <= daysInMonth; day++) {
        var dateStr =
          year +
          "-" +
          (month + 1).toString().padStart(2, "0") +
          "-" +
          day.toString().padStart(2, "0");
        var deals = this.state.dealsData[dateStr] || [];
        var isToday = dateStr === new Date().toISOString().split("T")[0];

        html.push(
          '<div class="day ' +
            (isToday ? "today " : "") +
            (deals.length ? "has-deals" : "") +
            '">',
          '<span class="day-number">' + day + "</span>",
          deals.length
            ? '<span class="deal-count">' + deals.length + "</span>"
            : "",
          "</div>"
        );
      }

      html.push("</div></div>");
      return html.join("");
    };

    // Основной метод отображения
    this.displayCalendar = function () {
      try {
        var html = this.generateCalendarHTML();

        if (this.isAMOCRM) {
          // Для amoCRM
          self.render({
            body: html,
            caption: { class_name: "orders-calendar" },
          });
        } else {
          // Для standalone режима
          var container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = html;
        }

        this.bindEvents();
      } catch (e) {
        console.error("Render error:", e);
        this.showError();
      }
    };

    // Привязка событий
    this.bindEvents = function () {
      $(document)
        .off("click", ".prev-month, .next-month")
        .on("click", ".prev-month", () => {
          this.state.currentDate.setMonth(
            this.state.currentDate.getMonth() - 1
          );
          this.displayCalendar();
        })
        .on("click", ".next-month", () => {
          this.state.currentDate.setMonth(
            this.state.currentDate.getMonth() + 1
          );
          this.displayCalendar();
        });
    };

    // Показать ошибку
    this.showError = function () {
      var errorHTML =
        '<div class="error-message">Ошибка загрузки календаря</div>';

      if (this.isAMOCRM) {
        self.render({
          body: errorHTML,
          caption: { class_name: "calendar-error" },
        });
      } else {
        var container = document.getElementById("widget-root") || document.body;
        container.innerHTML = errorHTML;
      }
    };

    // Загрузка данных
    this.loadData = function () {
      return new Promise((resolve) => {
        if (!this.isAMOCRM || !AmoCRM.request) {
          this.state.dealsData = this.generateMockData();
          return resolve();
        }

        var dateFrom = new Date(
          this.state.currentDate.getFullYear(),
          this.state.currentDate.getMonth(),
          1
        );
        var dateTo = new Date(
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
            this.state.dealsData = response?._embedded?.leads
              ? this.processData(response._embedded.leads)
              : this.generateMockData();
            resolve();
          })
          .catch((e) => {
            console.warn("Data load error:", e);
            this.state.dealsData = this.generateMockData();
            resolve();
          });
      });
    };

    // Callbacks для amoCRM
    this.callbacks = {
      init: () => Promise.resolve(true),

      render: () => {
        return this.loadData().then(() => {
          this.displayCalendar();
          return true;
        });
      },

      onSave: (settings) => {
        if (settings?.deal_date_field_id) {
          this.state.fieldIds.ORDER_DATE =
            parseInt(settings.deal_date_field_id) || 885453;
        }
        return true;
      },

      bind_actions: () => true,
      destroy: () => true,
    };

    return this;
  };

  return OrdersCalendarWidget;
});

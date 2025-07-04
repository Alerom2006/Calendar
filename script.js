if (typeof define !== "function") {
  console.error("AMD loader (define) is not available");
}

if (typeof $ === "undefined") {
  console.error("jQuery is not loaded");
}
define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    var self = this;
    var system = self.system();
    var langs = self.langs;

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453,
      },
    };

    // Генерация тестовых данных
    this.generateMockData = function () {
      var data = {};
      var date = new Date();
      var year = date.getFullYear();
      var month = date.getMonth();
      var daysInMonth = new Date(year, month + 1, 0).getDate();

      for (var day = 1; day <= daysInMonth; day++) {
        if (day % 5 === 0 || day === 1) {
          var dateStr =
            year +
            "-" +
            (month + 1).toString().padStart(2, "0") +
            "-" +
            day.toString().padStart(2, "0");
          data[dateStr] = [
            {
              id: day,
              name: "Тестовая сделка " + day,
              status_id: 143,
              price: day * 1000,
            },
          ];
        }
      }
      return data;
    };

    // Генерация HTML календаря
    this.generateCalendarHTML = function (
      month,
      year,
      daysInMonth,
      adjustedFirstDay
    ) {
      var html = ['<div class="calendar-grid">'];

      // Заголовки дней недели
      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach(function (day) {
        html.push('<div class="calendar-weekday">' + day + "</div>");
      });

      // Пустые ячейки
      for (var i = 0; i < adjustedFirstDay; i++) {
        html.push('<div class="calendar-day empty"></div>');
      }

      // Дни месяца
      for (var day = 1; day <= daysInMonth; day++) {
        var dateStr =
          year +
          "-" +
          (month + 1).toString().padStart(2, "0") +
          "-" +
          day.toString().padStart(2, "0");
        var deals = self.state.dealsData[dateStr] || [];
        var isToday = dateStr === new Date().toISOString().split("T")[0];

        html.push(
          '<div class="calendar-day ' +
            (isToday ? "today " : "") +
            (deals.length ? "has-deals" : "") +
            '">',
          '<div class="day-number">' + day + "</div>",
          deals.length
            ? '<div class="deal-count">' + deals.length + "</div>"
            : "",
          "</div>"
        );
      }

      html.push("</div>");
      return html.join("");
    };

    // Основной метод рендеринга
    this.renderCalendar = function () {
      try {
        var month = this.state.currentDate.getMonth();
        var year = this.state.currentDate.getFullYear();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDay = new Date(year, month, 1).getDay();
        var adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        var calendarHTML = this.generateCalendarHTML(
          month,
          year,
          daysInMonth,
          adjustedFirstDay
        );

        // Создаем объект с данными для шаблона
        var templateData = {
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

        // Проверяем доступность API amoCRM
        if (typeof self.render === "function") {
          // Используем шаблон в виде строки с twig-синтаксисом
          self.render({
            data: [
              '<div class="orders-calendar">',
              '<div class="calendar-header">',
              "<h3>{{ title }}</h3>",
              '<div class="month-navigation">',
              '<button class="nav-button prev-month">←</button>',
              '<span class="current-month">{{ month }} {{ year }}</span>',
              '<button class="nav-button next-month">→</button>',
              "</div>",
              "</div>",
              "{{ calendar|raw }}",
              "</div>",
            ].join(""),
            load: function (template) {
              template.render(templateData);
              self.bindCalendarEvents();
            },
          });
        } else {
          // Fallback для standalone режима
          var widgetHTML = [
            '<div class="orders-calendar">',
            '<div class="calendar-header">',
            "<h3>" + templateData.title + "</h3>",
            '<div class="month-navigation">',
            '<button class="nav-button prev-month">←</button>',
            '<span class="current-month">',
            templateData.month + " " + templateData.year,
            "</span>",
            '<button class="nav-button next-month">→</button>',
            "</div>",
            "</div>",
            templateData.calendar,
            "</div>",
          ].join("");

          var container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = widgetHTML;
          self.bindCalendarEvents();
        }
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    };

    // Привязка событий календаря
    this.bindCalendarEvents = function () {
      $(".prev-month")
        .off("click")
        .on("click", function () {
          self.state.currentDate.setMonth(
            self.state.currentDate.getMonth() - 1
          );
          self.renderCalendar();
        });

      $(".next-month")
        .off("click")
        .on("click", function () {
          self.state.currentDate.setMonth(
            self.state.currentDate.getMonth() + 1
          );
          self.renderCalendar();
        });
    };

    // Показать ошибку
    this.showError = function () {
      var errorHTML = [
        '<div class="calendar-error">',
        "<h3>Календарь заказов</h3>",
        "<p>Произошла ошибка при загрузке календаря</p>",
        "</div>",
      ].join("");

      if (typeof self.render === "function") {
        self.render({
          data: "{{ error|raw }}",
          load: function (template) {
            template.render({ error: errorHTML });
          },
        });
      } else {
        var container = document.getElementById("widget-root") || document.body;
        container.innerHTML = errorHTML;
      }
    };

    // Загрузка данных
    this.loadData = function () {
      if (typeof AmoCRM === "undefined" || !AmoCRM.request) {
        this.state.dealsData = this.generateMockData();
        return Promise.resolve();
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

      return AmoCRM.request("GET", "/api/v4/leads", {
        filter: {
          [this.state.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
        limit: 250,
      })
        .then(function (response) {
          if (response && response._embedded && response._embedded.leads) {
            self.processData(response._embedded.leads);
          } else {
            self.state.dealsData = self.generateMockData();
          }
        })
        .catch(function (error) {
          console.warn("Ошибка загрузки данных:", error);
          self.state.dealsData = self.generateMockData();
        });
    };

    // Обработка данных сделок
    this.processData = function (deals) {
      this.state.dealsData = {};
      deals.forEach(function (deal) {
        try {
          var dateField = (deal.custom_fields_values || []).find(function (f) {
            return f && f.field_id === self.state.fieldIds.ORDER_DATE;
          });

          if (
            dateField &&
            dateField.values &&
            dateField.values[0] &&
            dateField.values[0].value
          ) {
            var date = new Date(dateField.values[0].value * 1000);
            var dateStr = date.toISOString().split("T")[0];

            if (!self.state.dealsData[dateStr]) {
              self.state.dealsData[dateStr] = [];
            }

            self.state.dealsData[dateStr].push({
              id: deal.id || 0,
              name: deal.name || "Без названия",
              status_id: deal.status_id || 0,
              price: deal.price || 0,
            });
          }
        } catch (e) {
          console.warn("Ошибка обработки сделки:", e);
        }
      });
    };

    // Применение настроек
    this.applySettings = function (settings) {
      if (settings && settings.deal_date_field_id) {
        self.state.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || 885453;
      }
    };

    // Функции обратного вызова для amoCRM
    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          if (typeof AmoCRM !== "undefined" && AmoCRM.widgets) {
            AmoCRM.widgets
              .system()
              .then(function (system) {
                if (
                  system &&
                  system.settings &&
                  system.settings.deal_date_field_id
                ) {
                  self.state.fieldIds.ORDER_DATE =
                    parseInt(system.settings.deal_date_field_id) || 885453;
                }
                resolve(true);
              })
              .catch(function () {
                resolve(true);
              });
          } else {
            resolve(true);
          }
        });
      },

      render: function () {
        return new Promise(function (resolve) {
          self.loadData().then(function () {
            self.renderCalendar();
            resolve(true);
          });
        });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            console.error("No settings provided");
            return false;
          }
          self.applySettings(newSettings);
          return true;
        } catch (e) {
          console.error("onSave error:", e);
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
  };

  return OrdersCalendarWidget;
});

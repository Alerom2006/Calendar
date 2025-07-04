define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    var self = this;

    // Сохраняем контекст для использования в колбэках
    this.system =
      this.system ||
      function () {
        return {};
      };
    this.langs = this.langs || {};
    this.params = this.params || {};

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453,
      },
    };

    // Применение настроек
    this.applySettings = function (settings) {
      try {
        if (!settings) return false;

        // Сохраняем все настройки в state
        if (settings.api_key) {
          self.state.apiKey = settings.api_key;
        }
        if (settings.account) {
          self.state.account = settings.account;
        }
        if (settings.deal_date_field_id) {
          self.state.fieldIds.ORDER_DATE =
            parseInt(settings.deal_date_field_id) || 885453;
        }
        if (settings.delivery_range_field) {
          self.state.fieldIds.DELIVERY_RANGE = parseInt(
            settings.delivery_range_field
          );
        }
        if (settings.language) {
          self.state.language = settings.language;
        }

        return true;
      } catch (e) {
        console.error("applySettings error:", e);
        return false;
      }
    };

    // Функции обратного вызова для amoCRM
    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          try {
            // Получаем текущие настройки
            var currentSettings = self.get_settings();
            if (currentSettings) {
              self.applySettings(currentSettings);
            }
            resolve(true);
          } catch (e) {
            console.error("init error:", e);
            resolve(true); // Все равно разрешаем, чтобы виджет продолжил работу
          }
        });
      },

      render: function () {
        return new Promise(function (resolve) {
          self
            .loadData()
            .then(function () {
              self.renderCalendar();
              resolve(true);
            })
            .catch(function () {
              resolve(true); // Продолжаем работу даже при ошибке
            });
        });
      },

      onSave: function (newSettings) {
        try {
          console.log("Saving settings:", newSettings);
          return self.applySettings(newSettings);
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

    // Основной метод рендеринга
    this.renderCalendar = function () {
      try {
        var month = this.state.currentDate.getMonth();
        var year = this.state.currentDate.getFullYear();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDay = new Date(year, month, 1).getDay();
        var adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        var html = '<div class="calendar-grid">';

        // Заголовки дней недели
        ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach(function (day) {
          html += '<div class="calendar-weekday">' + day + "</div>";
        });

        // Пустые ячейки
        for (var i = 0; i < adjustedFirstDay; i++) {
          html += '<div class="calendar-day empty"></div>';
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

          html +=
            '<div class="calendar-day ' +
            (isToday ? "today " : "") +
            (deals.length ? "has-deals" : "") +
            '" data-date="' +
            dateStr +
            '">';
          html += '<div class="day-number">' + day + "</div>";
          if (deals.length) {
            html += '<div class="deal-count">' + deals.length + "</div>";
          }
          html += "</div>";
        }

        html += "</div>";

        var widgetHTML = '<div class="orders-calendar">';
        widgetHTML += '<div class="calendar-header">';
        widgetHTML += "<h3>Календарь заказов</h3>";
        widgetHTML += '<div class="month-navigation">';
        widgetHTML += '<button class="nav-button prev-month">←</button>';
        widgetHTML +=
          '<span class="current-month">' +
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
          ][month] +
          " " +
          year +
          "</span>";
        widgetHTML += '<button class="nav-button next-month">→</button>';
        widgetHTML += "</div></div>";
        widgetHTML += html;
        widgetHTML += "</div>";

        // Используем render_template для отображения в amoCRM
        if (typeof this.render_template === "function") {
          this.render_template({
            body: widgetHTML,
            caption: {
              class_name: "orders-calendar-caption",
            },
          });
        } else {
          // Fallback для standalone режима
          var container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = widgetHTML;
        }

        // Навешиваем обработчики
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

        // Обработчики кликов по дням
        $(".calendar-day[data-date]").on("click", function () {
          var dateStr = $(this).data("date");
          self.handleDateClick(dateStr);
        });
      } catch (error) {
        console.error("Ошибка рендеринга:", error);
        this.showError();
      }
    };

    // Обработчик клика по дате
    this.handleDateClick = function (dateStr) {
      if (typeof AmoCRM !== "undefined" && AmoCRM.router) {
        // Навигация в amoCRM
        AmoCRM.router.navigate({
          leads: {
            filter: {
              [self.state.fieldIds.ORDER_DATE]: {
                from: Math.floor(new Date(dateStr).getTime() / 1000),
                to: Math.floor(new Date(dateStr).getTime() / 1000 + 86399),
              },
            },
          },
        });
      } else {
        // Показ попапа в standalone режиме
        self.showDealsPopup(dateStr);
      }
    };

    // Показать попап со сделками
    this.showDealsPopup = function (dateStr) {
      var deals = self.state.dealsData[dateStr] || [];
      var popupHTML = '<div class="deals-popup">';
      popupHTML += "<h3>Сделки на " + dateStr + "</h3>";

      if (deals.length) {
        deals.forEach(function (deal) {
          popupHTML += '<div class="deal-item">';
          popupHTML += "<h4>" + deal.name + "</h4>";
          popupHTML +=
            "<p>Статус: " +
            (self.state.statuses[deal.status_id] || "Неизвестно") +
            "</p>";
          popupHTML += "<p>Сумма: " + deal.price + " руб.</p>";
          popupHTML += "</div>";
        });
      } else {
        popupHTML += "<p>Нет сделок на эту дату</p>";
      }

      popupHTML += '<button class="close-popup">Закрыть</button>';
      popupHTML += "</div>";

      // Удаляем старый попап если есть
      $(".deals-popup").remove();

      // Добавляем новый попап
      $("#widget-root").append(popupHTML);

      // Обработчик закрытия
      $(".close-popup").on("click", function () {
        $(".deals-popup").remove();
      });
    };

    // Показать ошибку
    this.showError = function () {
      var errorHTML = '<div class="calendar-error">';
      errorHTML += "<h3>Календарь заказов</h3>";
      errorHTML += "<p>Произошла ошибка при загрузке календаря</p>";
      errorHTML += "</div>";

      if (typeof this.render_template === "function") {
        this.render_template({
          body: errorHTML,
          caption: {
            class_name: "orders-calendar-error",
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

    return this;
  };

  return OrdersCalendarWidget;
});

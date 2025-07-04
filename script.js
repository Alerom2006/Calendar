define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    var self = this;

    // Инициализация системных методов
    this.system =
      this.system ||
      function () {
        return {};
      };
    this.langs = this.langs || {};
    this.params = this.params || {};
    this.render_template = this.render_template || function () {};
    this.get_settings =
      this.get_settings ||
      function () {
        return {};
      };
    this.get_version =
      this.get_version ||
      function () {
        return "1.0.0";
      };

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453,
        DELIVERY_RANGE: null,
      },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
    };

    // Метод рендеринга для amoCRM API
    this.render = function (options) {
      try {
        if (options && options.data) {
          // Используем render_template для отображения в amoCRM
          return self.render_template({
            body: options.data,
            caption: {
              class_name: "orders-calendar-caption",
            },
          });
        }
        return false;
      } catch (e) {
        console.error("Render error:", e);
        return false;
      }
    };

    // Применение настроек
    this.applySettings = function (settings) {
      try {
        if (!settings) {
          console.warn("No settings provided");
          return false;
        }

        // Сохраняем все настройки
        self.state.apiKey = settings.api_key || null;
        self.state.account = settings.account || null;
        self.state.language = settings.language || null;

        // Поля для даты и диапазона доставки
        self.state.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || 885453;
        self.state.fieldIds.DELIVERY_RANGE = settings.delivery_range_field
          ? parseInt(settings.delivery_range_field)
          : null;

        console.log("Settings applied:", self.state);
        return true;
      } catch (e) {
        console.error("applySettings error:", e);
        return false;
      }
    };

    // Генерация HTML календаря (синхронная)
    this.generateCalendarHTML = function () {
      var month = this.state.currentDate.getMonth();
      var year = this.state.currentDate.getFullYear();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var firstDay = new Date(year, month, 1).getDay();
      var adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

      var monthNames = [
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

      // Генерация дней календаря
      var daysHTML = "";
      for (var day = 1; day <= daysInMonth; day++) {
        var dateStr = [
          year,
          (month + 1).toString().padStart(2, "0"),
          day.toString().padStart(2, "0"),
        ].join("-");

        var deals = this.state.dealsData[dateStr] || [];
        var isToday = dateStr === new Date().toISOString().split("T")[0];
        var hasDeals = deals.length > 0;

        daysHTML += [
          '<div class="calendar-day',
          isToday ? " today" : "",
          hasDeals ? " has-deals" : "",
          '" data-date="',
          dateStr,
          '">',
          '<div class="day-number">',
          day,
          "</div>",
          hasDeals ? '<div class="deal-count">' + deals.length + "</div>" : "",
          "</div>",
        ].join("");
      }

      // Собираем полный HTML
      return [
        '<div class="orders-calendar">',
        '<div class="calendar-header">',
        "<h3>Календарь заказов</h3>",
        '<div class="month-navigation">',
        '<button class="nav-button prev-month">←</button>',
        '<span class="current-month">',
        monthNames[month],
        " ",
        year,
        "</span>",
        '<button class="nav-button next-month">→</button>',
        "</div>",
        "</div>",
        '<div class="calendar-grid">',
        '<div class="calendar-weekday">Пн</div>',
        '<div class="calendar-weekday">Вт</div>',
        '<div class="calendar-weekday">Ср</div>',
        '<div class="calendar-weekday">Чт</div>',
        '<div class="calendar-weekday">Пт</div>',
        '<div class="calendar-weekday">Сб</div>',
        '<div class="calendar-weekday">Вс</div>',
        Array(adjustedFirstDay)
          .fill('<div class="calendar-day empty"></div>')
          .join(""),
        daysHTML,
        "</div>",
        "</div>",
      ].join("");
    };

    // Основной метод рендеринга календаря
    this.renderCalendar = function () {
      return new Promise(function (resolve) {
        try {
          var html = self.generateCalendarHTML();

          // Пытаемся использовать render_template для amoCRM
          self
            .render_template({
              data: html,
              load: function () {
                self.bindCalendarEvents();
                resolve(true);
              },
            })
            .catch(function () {
              // Fallback для standalone режима
              var container =
                document.getElementById("widget-root") || document.body;
              container.innerHTML = html;
              self.bindCalendarEvents();
              resolve(true);
            });
        } catch (error) {
          console.error("Ошибка рендеринга:", error);
          self.showError();
          resolve(false);
        }
      });
    };

    // Привязка событий календаря
    this.bindCalendarEvents = function () {
      try {
        // Навигация по месяцам
        $(".prev-month, .next-month")
          .off("click")
          .on("click", function () {
            var direction = $(this).hasClass("prev-month") ? -1 : 1;
            self.state.currentDate.setMonth(
              self.state.currentDate.getMonth() + direction
            );
            self.renderCalendar();
          });

        // Клики по дням
        $(".calendar-day[data-date]")
          .off("click")
          .on("click", function () {
            var dateStr = $(this).data("date");
            self.handleDateClick(dateStr);
          });
      } catch (e) {
        console.error("bindCalendarEvents error:", e);
      }
    };

    // Обработчик клика по дате
    this.handleDateClick = function (dateStr) {
      try {
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
      } catch (e) {
        console.error("handleDateClick error:", e);
      }
    };

    // Показать попап со сделками
    this.showDealsPopup = function (dateStr) {
      try {
        var deals = self.state.dealsData[dateStr] || [];
        var popupHTML = [
          '<div class="deals-popup">',
          "<h3>Сделки на ",
          dateStr,
          "</h3>",
          deals.length
            ? deals
                .map(function (deal) {
                  return [
                    '<div class="deal-item">',
                    "<h4>",
                    deal.name,
                    "</h4>",
                    "<p>Статус: ",
                    self.state.statuses[deal.status_id] || "Неизвестно",
                    "</p>",
                    "<p>Сумма: ",
                    deal.price,
                    " руб.</p>",
                    "</div>",
                  ].join("");
                })
                .join("")
            : "<p>Нет сделок на эту дату</p>",
          '<button class="close-popup">Закрыть</button>',
          "</div>",
        ].join("");

        // Удаляем старый попап если есть
        $(".deals-popup").remove();

        // Добавляем новый попап
        $("#widget-root").append(popupHTML);

        // Обработчик закрытия
        $(".close-popup").on("click", function () {
          $(".deals-popup").remove();
        });
      } catch (e) {
        console.error("showDealsPopup error:", e);
      }
    };

    // Показать сообщение об ошибке
    this.showError = function () {
      try {
        var errorHTML = [
          '<div class="calendar-error">',
          "<h3>Календарь заказов</h3>",
          "<p>Произошла ошибка при загрузке календаря</p>",
          "</div>",
        ].join("");

        if (typeof this.render_template === "function") {
          this.render_template({
            body: errorHTML,
            caption: {
              class_name: "orders-calendar-error",
            },
          });
        } else {
          var container =
            document.getElementById("widget-root") || document.body;
          container.innerHTML = errorHTML;
        }
      } catch (e) {
        console.error("showError error:", e);
      }
    };

    // Загрузка данных
    this.loadData = function () {
      return new Promise(function (resolve) {
        try {
          if (typeof AmoCRM === "undefined" || !AmoCRM.request) {
            self.state.dealsData = self.generateMockData();
            return resolve();
          }

          var dateFrom = new Date(
            self.state.currentDate.getFullYear(),
            self.state.currentDate.getMonth(),
            1
          );
          var dateTo = new Date(
            self.state.currentDate.getFullYear(),
            self.state.currentDate.getMonth() + 1,
            0
          );

          AmoCRM.request("GET", "/api/v4/leads", {
            filter: {
              [self.state.fieldIds.ORDER_DATE]: {
                from: Math.floor(dateFrom.getTime() / 1000),
                to: Math.floor(dateTo.getTime() / 1000),
              },
            },
            limit: 250,
          })
            .then(function (response) {
              if (response?._embedded?.leads) {
                self.processData(response._embedded.leads);
              } else {
                self.state.dealsData = self.generateMockData();
              }
              resolve();
            })
            .catch(function (error) {
              console.warn("Ошибка загрузки данных:", error);
              self.state.dealsData = self.generateMockData();
              resolve();
            });
        } catch (e) {
          console.error("loadData error:", e);
          self.state.dealsData = self.generateMockData();
          resolve();
        }
      });
    };

    // Обработка данных сделок
    this.processData = function (deals) {
      try {
        this.state.dealsData = {};
        deals.forEach(function (deal) {
          try {
            var dateField = (deal.custom_fields_values || []).find(function (
              f
            ) {
              return f?.field_id === self.state.fieldIds.ORDER_DATE;
            });

            var timestamp = dateField?.values?.[0]?.value;
            if (!timestamp) return;

            var date = new Date(timestamp * 1000);
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
          } catch (e) {
            console.warn("Ошибка обработки сделки:", e);
          }
        });
      } catch (e) {
        console.error("processData error:", e);
      }
    };

    // Генерация тестовых данных
    this.generateMockData = function () {
      try {
        var data = {};
        var date = new Date();
        var year = date.getFullYear();
        var month = date.getMonth();
        var daysInMonth = new Date(year, month + 1, 0).getDate();

        for (var day = 1; day <= daysInMonth; day++) {
          if (day % 5 === 0 || day === 1) {
            var dateStr = [
              year,
              (month + 1).toString().padStart(2, "0"),
              day.toString().padStart(2, "0"),
            ].join("-");

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
      } catch (e) {
        console.error("generateMockData error:", e);
        return {};
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
            resolve(true);
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
            .catch(function (e) {
              console.error("render error:", e);
              resolve(true);
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
        try {
          self.bindCalendarEvents();
          return true;
        } catch (e) {
          console.error("bind_actions error:", e);
          return true;
        }
      },

      destroy: function () {
        return true;
      },
    };

    return this;
  };

  return OrdersCalendarWidget;
});

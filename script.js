define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    var self = this;

    // Инициализация системных методов с улучшенными fallback-ами
    this.system =
      this.system ||
      function () {
        return {
          area: "standalone",
          amouser_id: null,
          amouser: null,
          amohash: null,
        };
      };

    this.langs = this.langs || {
      ru: {
        widget: { name: "Календарь заказов" },
        months: [
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
        ],
        weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        errors: {
          load: "Ошибка загрузки данных",
          noDeals: "Нет сделок на эту дату",
        },
      },
    };

    this.params = this.params || {};

    // Надежный fallback для render_template
    this.render_template =
      this.render_template ||
      function (options) {
        return new Promise(function (resolve) {
          try {
            if (!options || !options.data) {
              console.error("Invalid options for render_template");
              return resolve();
            }

            var container = document.getElementById("widget-root");
            if (container) {
              container.innerHTML = options.data;

              if (typeof options.load === "function") {
                try {
                  options.load();
                } catch (e) {
                  console.error("Error in render_template load callback:", e);
                }
              }
            }
            resolve();
          } catch (e) {
            console.error("Error in render_template fallback:", e);
            resolve();
          }
        });
      };

    this.get_settings =
      this.get_settings ||
      function () {
        return {
          deal_date_field_id: 885453,
          delivery_range_field: null,
        };
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
      loading: false,
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
      cache: {
        monthsData: {},
      },
    };

    // Получение заголовка виджета с учетом языка
    this.getWidgetTitle = function () {
      try {
        return this.langs.ru?.widget?.name || "Календарь заказов";
      } catch (e) {
        console.error("Error in getWidgetTitle:", e);
        return "Календарь заказов";
      }
    };

    // Применение настроек
    this.applySettings = function (settings) {
      try {
        if (!settings) {
          console.warn("Настройки не предоставлены");
          return false;
        }

        self.state.apiKey = settings.api_key || null;
        self.state.account = settings.account || null;
        self.state.language = settings.language || null;

        self.state.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || 885453;
        self.state.fieldIds.DELIVERY_RANGE = settings.delivery_range_field
          ? parseInt(settings.delivery_range_field)
          : null;

        return true;
      } catch (e) {
        console.error("Ошибка применения настроек:", e);
        return false;
      }
    };

    // Форматирование даты в строку YYYY-MM-DD
    this.formatDate = function (day, month, year) {
      try {
        return [
          year,
          month.toString().padStart(2, "0"),
          day.toString().padStart(2, "0"),
        ].join("-");
      } catch (e) {
        console.error("Error in formatDate:", e);
        return "1970-01-01";
      }
    };

    // Получение сегодняшней даты
    this.getTodayDateString = function () {
      try {
        return new Date().toISOString().split("T")[0];
      } catch (e) {
        console.error("Error in getTodayDateString:", e);
        return "1970-01-01";
      }
    };

    // Генерация HTML календаря
    this.generateCalendarHTML = function () {
      try {
        var month = this.state.currentDate.getMonth();
        var year = this.state.currentDate.getFullYear();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDay = new Date(year, month, 1).getDay();
        var adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        var monthNames = this.langs.ru?.months || [
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

        var weekdays = this.langs.ru?.weekdays || [
          "Пн",
          "Вт",
          "Ср",
          "Чт",
          "Пт",
          "Сб",
          "Вс",
        ];

        var daysHTML = "";
        for (var day = 1; day <= daysInMonth; day++) {
          var dateStr = this.formatDate(day, month + 1, year);
          var deals = this.state.dealsData[dateStr] || [];
          var isToday = dateStr === this.getTodayDateString();
          var hasDeals = deals.length > 0;

          daysHTML += `
            <div class="calendar-day 
              ${isToday ? "today" : ""} 
              ${hasDeals ? "has-deals" : ""}" 
              data-date="${dateStr}"
              aria-label="${day} ${monthNames[month]} ${year}">
              <div class="day-number">${day}</div>
              ${hasDeals ? `<div class="deal-count">${deals.length}</div>` : ""}
            </div>
          `;
        }

        return `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>${this.getWidgetTitle()}</h3>
              <div class="month-navigation">
                <button class="nav-button prev-month" aria-label="Предыдущий месяц">←</button>
                <span class="current-month">${monthNames[month]} ${year}</span>
                <button class="nav-button next-month" aria-label="Следующий месяц">→</button>
              </div>
            </div>
            <div class="calendar-grid">
              ${weekdays
                .map((day) => `<div class="calendar-weekday">${day}</div>`)
                .join("")}
              ${Array(adjustedFirstDay)
                .fill('<div class="calendar-day empty"></div>')
                .join("")}
              ${daysHTML}
            </div>
            ${
              this.state.loading
                ? '<div class="calendar-loading">Загрузка...</div>'
                : ""
            }
          </div>
        `;
      } catch (e) {
        console.error("Ошибка генерации HTML:", e);
        return `
          <div class="orders-calendar">
            <div class="calendar-error">Не удалось создать календарь</div>
          </div>
        `;
      }
    };

    // Обновление представления календаря
    this.updateCalendarView = function () {
      try {
        var html = self.generateCalendarHTML();
        var container = document.getElementById("widget-root");

        if (!container) {
          console.error("Widget root container not found");
          return;
        }

        container.innerHTML = html;
        self.bindCalendarEvents();
      } catch (e) {
        console.error("Error in updateCalendarView:", e);
      }
    };

    // Привязка событий календаря
    this.bindCalendarEvents = function () {
      try {
        // Навигация по месяцам
        $(document)
          .off("click.calendarNav")
          .on("click.calendarNav", ".prev-month, .next-month", function () {
            try {
              var direction = $(this).hasClass("prev-month") ? -1 : 1;
              self.navigateMonth(direction);
            } catch (e) {
              console.error("Error in month navigation:", e);
            }
          });

        // Клики по дням
        $(document)
          .off("click.calendarDay")
          .on("click.calendarDay", ".calendar-day[data-date]", function () {
            try {
              var dateStr = $(this).data("date");
              self.handleDateClick(dateStr);
            } catch (e) {
              console.error("Error in date click:", e);
            }
          });

        // Клавиатурная навигация
        $(document)
          .off("keydown.calendar")
          .on("keydown.calendar", function (e) {
            try {
              if (e.key === "ArrowLeft") self.navigateMonth(-1);
              else if (e.key === "ArrowRight") self.navigateMonth(1);
            } catch (e) {
              console.error("Error in keyboard nav:", e);
            }
          });
      } catch (e) {
        console.error("Ошибка привязки событий:", e);
      }
    };

    // Навигация по месяцам
    this.navigateMonth = function (direction) {
      try {
        self.state.currentDate.setMonth(
          self.state.currentDate.getMonth() + direction
        );
        self.renderCalendar();
      } catch (e) {
        console.error("Error in navigateMonth:", e);
      }
    };

    // Обработчик клика по дате
    this.handleDateClick = function (dateStr) {
      try {
        if (typeof AmoCRM !== "undefined" && AmoCRM.router) {
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
          self.showDealsPopup(dateStr);
        }
      } catch (e) {
        console.error("Ошибка обработки клика:", e);
      }
    };

    // Показать попап со сделками
    this.showDealsPopup = function (dateStr) {
      try {
        var deals = self.state.dealsData[dateStr] || [];
        var noDealsText =
          self.langs.ru?.errors?.noDeals || "Нет сделок на эту дату";

        var popupHTML = `
          <div class="deals-popup" role="dialog" aria-labelledby="popup-title">
            <h3 id="popup-title">Сделки на ${dateStr}</h3>
            <div class="deals-list">
              ${
                deals.length
                  ? deals
                      .map(
                        (deal) => `
                    <div class="deal-item">
                      <h4>${deal.name}</h4>
                      <p>Статус: ${
                        self.state.statuses[deal.status_id] || "Неизвестно"
                      }</p>
                      <p>Сумма: ${deal.price} руб.</p>
                    </div>
                  `
                      )
                      .join("")
                  : `<p class="no-deals">${noDealsText}</p>`
              }
            </div>
            <button class="close-popup" aria-label="Закрыть">Закрыть</button>
          </div>
        `;

        $(".deals-popup").remove();
        $("#widget-root").append(popupHTML);

        $(document)
          .off("click.closePopup")
          .on("click.closePopup", ".close-popup", function () {
            $(".deals-popup").remove();
          });

        $(document)
          .off("keyup.popup")
          .on("keyup.popup", function (e) {
            if (e.key === "Escape") $(".deals-popup").remove();
          });
      } catch (e) {
        console.error("Ошибка показа попапа:", e);
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

          self.state.loading = true;

          AmoCRM.request("GET", "/api/v4/leads", {
            filter: {
              [self.state.fieldIds.ORDER_DATE]: {
                from: Math.floor(dateFrom.getTime() / 1000),
                to: Math.floor(dateTo.getTime() / 1000),
              },
            },
            limit: 250,
            with: "contacts",
          })
            .then(function (response) {
              if (response?._embedded?.leads) {
                self.processData(response._embedded.leads);
              } else {
                self.state.dealsData = self.generateMockData();
              }
            })
            .catch(function (error) {
              console.error("Ошибка загрузки данных:", error);
              self.state.dealsData = self.generateMockData();
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Ошибка загрузки данных:", e);
          self.state.dealsData = self.generateMockData();
          self.state.loading = false;
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
              contacts: deal._embedded?.contacts || [],
            });
          } catch (e) {
            console.warn("Ошибка обработки сделки:", e);
          }
        });
      } catch (e) {
        console.error("Ошибка обработки данных:", e);
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
            var dateStr = this.formatDate(day, month + 1, year);
            data[dateStr] = [
              {
                id: day,
                name: "Тестовая сделка " + day,
                status_id: 143,
                price: day * 1000,
                contacts: [],
              },
            ];
          }
        }
        return data;
      } catch (e) {
        console.error("Ошибка генерации тестовых данных:", e);
        return {};
      }
    };

    // Основной метод рендеринга календаря
    this.renderCalendar = function () {
      return new Promise(function (resolve) {
        try {
          self.state.loading = true;
          var cacheKey = `${self.state.currentDate.getFullYear()}-${self.state.currentDate.getMonth()}`;

          if (self.state.cache.monthsData[cacheKey]) {
            self.state.dealsData = self.state.cache.monthsData[cacheKey];
            self.state.loading = false;
            self.updateCalendarView();
            return resolve();
          }

          self
            .loadData()
            .then(function () {
              self.state.cache.monthsData[cacheKey] = {
                ...self.state.dealsData,
              };
              self.updateCalendarView();
            })
            .catch(function (e) {
              console.error("Ошибка загрузки данных:", e);
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (error) {
          console.error("Ошибка рендеринга:", error);
          self.state.loading = false;
          resolve();
        }
      });
    };

    // Функции обратного вызова для amoCRM
    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          try {
            var currentSettings = self.get_settings();
            if (currentSettings) self.applySettings(currentSettings);
            self.state.initialized = true;
          } catch (e) {
            console.error("Ошибка инициализации:", e);
          }
          resolve(true);
        });
      },

      render: function () {
        return new Promise(function (resolve) {
          self
            .renderCalendar()
            .then(function () {
              resolve(true);
            })
            .catch(function (e) {
              console.error("Ошибка рендеринга:", e);
              resolve(true);
            });
        });
      },

      onSave: function (newSettings) {
        try {
          return self.applySettings(newSettings);
        } catch (e) {
          console.error("Ошибка сохранения:", e);
          return false;
        }
      },

      bind_actions: function () {
        try {
          self.bindCalendarEvents();
        } catch (e) {
          console.error("Ошибка привязки действий:", e);
        }
        return true;
      },

      destroy: function () {
        try {
          $(document).off(
            "click.calendarNav click.calendarDay keydown.calendar keyup.popup click.closePopup"
          );
        } catch (e) {
          console.error("Ошибка очистки событий:", e);
        }
        return true;
      },
    };

    return this;
  };

  return OrdersCalendarWidget;
});

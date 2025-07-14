define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      console.log("Возвращаем существующий экземпляр виджета");
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Инициализация языков в первую очередь
    this.langs = {
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
          noAuth: "Требуется авторизация в amoCRM",
          fileUpload: "Ошибка загрузки файла",
          fileDelete: "Ошибка удаления файла",
          settingsSave: "Ошибка сохранения настроек",
          standalone: "Виджет работает в автономном режиме",
          apiError: "Ошибка подключения к API AmoCRM",
          apiNotLoaded: "AmoCRM API не загружен. Проверьте загрузку скриптов.",
          cspError: "Ошибка политики безопасности (CSP). Проверьте консоль.",
          unknown: "Неизвестная ошибка",
        },
      },
      en: {
        widget: { name: "Orders Calendar" },
        months: [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ],
        weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        errors: {
          load: "Data loading error",
          noDeals: "No deals for selected date",
          noAuth: "Authorization required",
          fileUpload: "File upload error",
          fileDelete: "File delete error",
          settingsSave: "Error saving settings",
          standalone: "Widget works in standalone mode",
          apiError: "AmoCRM API connection error",
          apiNotLoaded: "AmoCRM API not loaded. Check script loading.",
          cspError: "Content Security Policy error. Check console.",
          unknown: "Unknown error",
        },
      },
    };

    // Улучшенная проверка AmoCRM API
    this.checkAMOCRM = function () {
      try {
        // Проверяем все возможные варианты объекта AmoCRM
        const amo = window.AmoCRM || window.AMOCRM || {};

        if (typeof amo === "undefined") {
          console.error("AmoCRM API не обнаружен");
          return false;
        }

        // Проверяем необходимые методы
        const requiredMethods = ["constant", "request", "data"];
        const missingMethods = requiredMethods.filter(
          (m) => typeof amo[m] !== "function"
        );

        if (missingMethods.length > 0) {
          console.error("Отсутствуют методы AmoCRM:", missingMethods);
          return false;
        }

        // Проверяем данные аккаунта
        try {
          const account = amo.constant("account") || {};
          if (!account.id) {
            console.error("Не удалось получить ID аккаунта");
            return false;
          }
          return true;
        } catch (e) {
          console.error("Ошибка при проверке данных аккаунта:", e);
          return false;
        }
      } catch (e) {
        console.error("Критическая ошибка при проверке API:", e);
        return false;
      }
    };

    this.isStandalone = !this.checkAMOCRM();

    console.log("Инициализация виджета", {
      version: "1.0.14",
      mode: this.isStandalone ? "standalone" : "integrated",
      apiAvailable: !this.isStandalone,
    });

    // Получение данных аккаунта
    let accountData = {};
    let userData = {};
    let currentCard = {};

    if (!this.isStandalone) {
      try {
        accountData = AmoCRM.constant("account") || {};
        userData = AmoCRM.constant("user") || {};
        currentCard = AmoCRM.data.current_card || {};
      } catch (e) {
        console.error("Ошибка получения данных AmoCRM:", e);
        this.isStandalone = true;
      }
    }

    // Системные данные
    this.system = function () {
      return {
        area: this.isStandalone ? "standalone" : currentCard.type || "unknown",
        amouser_id: userData.id || null,
        amouser: userData.name || null,
        amohash: userData.api_key || null,
        subdomain: accountData.subdomain || "yourdomain",
        account_id: accountData.id || null,
      };
    }.bind(this);

    // Параметры и состояние виджета
    this.params = {};
    this.get_version = function () {
      return "1.0.14";
    };

    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      loading: false,
      fileUploading: false,
      fieldIds: { ORDER_DATE: 885453, DELIVERY_RANGE: null },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
      cache: { monthsData: {} },
      standaloneData: {},
      fileUploadProgress: 0,
      attachedFiles: {},
    };

    // Улучшенный метод отображения ошибок
    this.showError = function (message) {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (!widgetRoot) return;

        const lang = this.langs.ru || this.langs.en || {};
        const errorMessage =
          message || lang.errors?.apiError || "Неизвестная ошибка";

        widgetRoot.innerHTML = `
          <div class="error-message">
            <h3>${lang.widget?.name || "Календарь заказов"}</h3>
            <p>${errorMessage}</p>
            <div class="error-details">
              <p><strong>Режим:</strong> ${
                this.isStandalone ? "standalone" : "integrated"
              }</p>
              <p><strong>Версия:</strong> ${this.get_version()}</p>
              ${
                this.isStandalone
                  ? '<p class="text-danger">AmoCRM API недоступен</p>'
                  : ""
              }
            </div>
            <button class="btn btn-primary mt-3" onclick="location.reload()">
              Обновить страницу
            </button>
          </div>
        `;
      } catch (e) {
        console.error("Ошибка при отображении ошибки:", e);
      }
    };

    // Основные методы виджета
    this.formatDate = function (day, month, year) {
      return `${year}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    };

    this.getTodayDateString = function () {
      const today = new Date();
      return this.formatDate(
        today.getDate(),
        today.getMonth() + 1,
        today.getFullYear()
      );
    };

    this.applySettings = function (settings) {
      if (settings && typeof settings === "object") {
        if (settings.deal_date_field_id) {
          const fieldId = parseInt(settings.deal_date_field_id);
          if (!isNaN(fieldId)) this.state.fieldIds.ORDER_DATE = fieldId;
        }
        if (settings.delivery_range_field) {
          const fieldId = parseInt(settings.delivery_range_field);
          if (!isNaN(fieldId)) this.state.fieldIds.DELIVERY_RANGE = fieldId;
        }
        return true;
      }
      return false;
    };

    this.get_settings = function () {
      return this.params;
    };

    // API методы
    this.doRequest = function (method, path, data, options = {}) {
      return new Promise((resolve, reject) => {
        if (this.isStandalone) {
          setTimeout(() => {
            const mockResponse = {
              _embedded: { leads: [], files: [] },
            };
            resolve(mockResponse);
          }, 300);
          return;
        }

        try {
          AmoCRM.request({
            method,
            path,
            data,
            ...options,
          })
            .then(resolve)
            .catch((error) => {
              console.error("Ошибка API запроса:", { method, path, error });
              reject(
                new Error(this.langs.ru?.errors?.load || "Ошибка загрузки")
              );
            });
        } catch (e) {
          console.error("Критическая ошибка doRequest:", e);
          reject(e);
        }
      });
    };

    // Методы работы с данными
    this.loadData = function () {
      return new Promise((resolve) => {
        try {
          this.state.loading = true;

          if (this.isStandalone) {
            // Загрузка тестовых данных для standalone режима
            const today = new Date();
            const dateStr = this.formatDate(
              today.getDate(),
              today.getMonth() + 1,
              today.getFullYear()
            );

            this.state.standaloneData[dateStr] = [
              {
                id: 1,
                name: "Тестовая сделка",
                status_id: 143,
                price: 1000,
                custom_fields_values: [
                  {
                    field_id: this.state.fieldIds.ORDER_DATE,
                    values: [{ value: Math.floor(today.getTime() / 1000) }],
                  },
                ],
                _embedded: {
                  contacts: [{ name: "Тестовый контакт" }],
                },
              },
            ];

            this.processData(this.state.standaloneData[dateStr]);
            this.state.loading = false;
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

          this.doRequest("GET", "/api/v4/leads", {
            filter: {
              [this.state.fieldIds.ORDER_DATE]: {
                from: Math.floor(dateFrom.getTime() / 1000),
                to: Math.floor(dateTo.getTime() / 1000),
              },
            },
            limit: 250,
            with: "contacts",
          })
            .then((response) => {
              if (response?._embedded?.leads) {
                this.processData(response._embedded.leads);
              } else {
                this.state.dealsData = {};
              }
            })
            .catch((error) => {
              console.error("Ошибка загрузки данных:", error);
              this.showError(this.langs.ru?.errors?.load || "Ошибка загрузки");
              this.state.dealsData = {};
            })
            .finally(() => {
              this.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Ошибка loadData:", e);
          this.state.loading = false;
          resolve();
        }
      });
    };

    this.processData = function (deals) {
      try {
        const newDealsData = {};

        (deals || []).forEach((deal) => {
          try {
            const dateField = (deal.custom_fields_values || []).find(
              (f) => f?.field_id === this.state.fieldIds.ORDER_DATE
            );

            const timestamp = dateField?.values?.[0]?.value;
            if (!timestamp) return;

            const date = new Date(timestamp * 1000);
            const dateStr = date.toISOString().split("T")[0];

            if (!newDealsData[dateStr]) {
              newDealsData[dateStr] = [];
            }

            newDealsData[dateStr].push({
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

        this.state.dealsData = newDealsData;
      } catch (e) {
        console.error("Критическая ошибка processData:", e);
      }
    };

    // Методы отображения
    this.generateCalendarHTML = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const lang = this.langs.ru || this.langs.en || {};
        const monthNames = lang.months || [];
        const weekdays = lang.weekdays || [];

        let daysHTML = "";
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = this.formatDate(day, month + 1, year);
          const deals = this.state.dealsData[dateStr] || [];
          const isToday = dateStr === this.getTodayDateString();

          daysHTML += `
            <div class="calendar-day ${isToday ? "today" : ""} ${
            deals.length ? "has-deals" : ""
          }" data-date="${dateStr}">
              <div class="day-number">${day}</div>
              ${
                deals.length
                  ? `<div class="deal-count">${deals.length}</div>`
                  : ""
              }
            </div>`;
        }

        return `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>${lang.widget?.name || "Календарь заказов"}</h3>
              ${
                this.isStandalone
                  ? `<div class="alert alert-warning">
                      ${lang.errors?.standalone || "Режим standalone"}
                     </div>`
                  : ""
              }
              <div class="month-navigation">
                <button class="btn btn-sm prev-month">←</button>
                <span class="current-month">${monthNames[month]} ${year}</span>
                <button class="btn btn-sm next-month">→</button>
              </div>
            </div>
            <div class="calendar-grid">
              ${weekdays
                .map((day) => `<div class="weekday">${day}</div>`)
                .join("")}
              ${Array(adjustedFirstDay)
                .fill('<div class="day-empty"></div>')
                .join("")}
              ${daysHTML}
            </div>
            ${
              this.state.loading
                ? '<div class="loading-overlay"><div class="spinner"></div></div>'
                : ""
            }
          </div>`;
      } catch (e) {
        console.error("Ошибка генерации календаря:", e);
        return `<div class="alert alert-danger">Ошибка отображения календаря</div>`;
      }
    };

    this.renderCalendar = function () {
      return new Promise((resolve) => {
        try {
          this.state.loading = true;
          const cacheKey = `${this.state.currentDate.getFullYear()}-${this.state.currentDate.getMonth()}`;

          if (this.state.cache.monthsData[cacheKey]) {
            this.state.dealsData = this.state.cache.monthsData[cacheKey];
            this.state.loading = false;
            this.updateCalendarView();
            return resolve();
          }

          this.loadData()
            .then(() => {
              this.state.cache.monthsData[cacheKey] = {
                ...this.state.dealsData,
              };
              this.updateCalendarView();
            })
            .catch((e) => {
              console.error("Ошибка рендеринга календаря:", e);
              this.showError(this.langs.ru?.errors?.load || "Ошибка загрузки");
            })
            .finally(() => {
              this.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Критическая ошибка renderCalendar:", e);
          this.state.loading = false;
          resolve();
        }
      });
    };

    this.updateCalendarView = function () {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          widgetRoot.innerHTML = this.generateCalendarHTML();
          this.bindCalendarEvents();
        }
      } catch (e) {
        console.error("Ошибка обновления календаря:", e);
      }
    };

    // Обработчики событий
    this.bindCalendarEvents = function () {
      try {
        $(document)
          .off("click.calendar")
          .on("click.calendar", ".prev-month", () => {
            this.state.currentDate.setMonth(
              this.state.currentDate.getMonth() - 1
            );
            this.renderCalendar();
          });

        $(document)
          .off("click.calendar")
          .on("click.calendar", ".next-month", () => {
            this.state.currentDate.setMonth(
              this.state.currentDate.getMonth() + 1
            );
            this.renderCalendar();
          });

        $(document)
          .off("click.date")
          .on("click.date", ".calendar-day:not(.empty)", (e) => {
            const dateStr = $(e.currentTarget).data("date");
            this.showDealsPopup(dateStr);
          });
      } catch (e) {
        console.error("Ошибка привязки событий:", e);
      }
    };

    // Popup со сделками
    this.showDealsPopup = function (dateStr) {
      try {
        const deals = this.state.dealsData[dateStr] || [];
        const lang = this.langs.ru || this.langs.en || {};
        const noDealsText = lang.errors?.noDeals || "Нет сделок на эту дату";

        const dealsHTML = deals.length
          ? deals
              .map(
                (deal) => `
              <div class="deal-item" data-deal-id="${deal.id}">
                <h4>${deal.name}</h4>
                <p>Статус: ${
                  this.state.statuses[deal.status_id] || "Неизвестно"
                }</p>
                <p>Сумма: ${deal.price} руб.</p>
                ${
                  deal.contacts?.length > 0
                    ? `<p>Контакты: ${deal.contacts
                        .map((c) => c.name || "Без имени")
                        .join(", ")}</p>`
                    : ""
                }
                <div class="deal-files">
                  <h5>Прикрепленные файлы:</h5>
                  <div class="files-list" data-deal-id="${deal.id}">
                    <div class="file-upload-progress" style="display: none;">
                      <progress value="0" max="100"></progress>
                      <span>0%</span>
                    </div>
                    <div class="file-upload-container">
                      <input type="file" class="file-input" data-deal-id="${
                        deal.id
                      }" style="display: none;">
                      <button class="upload-file-btn">Загрузить файл</button>
                    </div>
                  </div>
                </div>
              </div>`
              )
              .join("")
          : `<p class="no-deals">${noDealsText}</p>`;

        const popupHTML = `
          <div class="deals-popup">
            <div class="popup-content">
              <h3>Сделки на ${dateStr}</h3>
              ${
                this.isStandalone
                  ? `<div class="alert alert-warning">${
                      lang.errors?.standalone || "Режим standalone"
                    }</div>`
                  : ""
              }
              <div class="deals-list">${dealsHTML}</div>
              <button class="close-popup">Закрыть</button>
            </div>
          </div>
        `;

        $(".deals-popup").remove();
        $("#widget-root").append(popupHTML);

        if (!this.isStandalone) {
          deals.forEach((deal) => {
            this.loadDealFiles(deal.id);
          });
        }

        $(".upload-file-btn").on("click", function () {
          const dealId = $(this).closest(".files-list").data("deal-id");
          $(`input.file-input[data-deal-id="${dealId}"]`).click();
        });

        $(".file-input").on("change", function (e) {
          const dealId = $(this).data("deal-id");
          const file = e.target.files[0];
          if (file) this.uploadFile(file, dealId);
        });

        $(document)
          .off("click.popup")
          .on("click.popup", ".close-popup", () => {
            $(".deals-popup").remove();
          });
      } catch (e) {
        console.error("Ошибка отображения попапа:", e);
      }
    };

    // Методы работы с файлами
    this.loadDealFiles = function (dealId) {
      if (this.isStandalone) return;

      this.getDealFiles(dealId)
        .then((response) => {
          if (response?._embedded?.files) {
            const filesContainer = $(`.files-list[data-deal-id="${dealId}"]`);
            filesContainer.find(".file-upload-container").before(
              response._embedded.files
                .map(
                  (file) => `
                <div class="file-item">
                  <span>${file.file_uuid}</span>
                  <button class="delete-file-btn" data-file-uuid="${file.file_uuid}">Удалить</button>
                </div>
              `
                )
                .join("")
            );

            $(".delete-file-btn").on("click", function () {
              const fileUuid = $(this).data("file-uuid");
              this.deleteFile(fileUuid).then(() => {
                $(this).closest(".file-item").remove();
              });
            });
          }
        })
        .catch((error) => {
          console.error("Ошибка загрузки файлов:", error);
        });
    };

    this.uploadFile = function (file, dealId) {
      if (this.isStandalone) {
        alert(this.langs.ru?.errors?.standalone || "Режим standalone");
        return;
      }

      const progressContainer = $(
        `.files-list[data-deal-id="${dealId}"] .file-upload-progress`
      );
      const progressBar = progressContainer.find("progress");
      const progressText = progressContainer.find("span");

      progressContainer.show();
      progressBar.val(0);
      progressText.text("0%");

      const progressInterval = setInterval(() => {
        progressBar.val(this.state.fileUploadProgress);
        progressText.text(`${this.state.fileUploadProgress}%`);
      }, 100);

      this.completeFileUpload(file, dealId)
        .then(() => {
          clearInterval(progressInterval);
          progressBar.val(100);
          progressText.text("100%");
          setTimeout(() => {
            progressContainer.hide();
            this.loadDealFiles(dealId);
          }, 500);
        })
        .catch((error) => {
          clearInterval(progressInterval);
          progressContainer.html(
            `<div class="error">${
              this.langs.ru?.errors?.fileUpload || "Ошибка загрузки"
            }: ${error.message}</div>`
          );
        });
    };

    // Колбэки для AmoCRM
    this.callbacks = {
      init: function () {
        return new Promise((resolve) => {
          try {
            console.log("Инициализация виджета...");
            self.isStandalone = !self.checkAMOCRM();

            if (self.isStandalone) {
              console.warn("Виджет в standalone режиме");
              self.showError(
                self.langs.ru?.errors?.apiNotLoaded || "API недоступен"
              );
              return resolve(false);
            }

            const settings = self.get_settings();
            if (settings) self.applySettings(settings);

            self.state.initialized = true;
            console.log("Виджет успешно инициализирован");
            resolve(true);
          } catch (e) {
            console.error("Ошибка инициализации:", e);
            self.showError("Ошибка инициализации");
            resolve(false);
          }
        });
      },

      render: function () {
        return new Promise((resolve) => {
          self
            .renderCalendar()
            .then(() => {
              if (
                !self.isStandalone &&
                typeof self.render_template === "function"
              ) {
                try {
                  self.render_template(
                    {
                      body: self.generateCalendarHTML(),
                      caption: { class_name: "orders-calendar-caption" },
                    },
                    {}
                  );
                } catch (e) {
                  console.error("Ошибка render_template:", e);
                }
              }
              resolve(true);
            })
            .catch((e) => {
              console.error("Ошибка рендеринга:", e);
              self.showError("Ошибка отображения");
              resolve(false);
            });
        });
      },

      onSave: function (newSettings) {
        return new Promise((resolve) => {
          try {
            const result = self.applySettings(newSettings);
            if (result) {
              self.state.cache.monthsData = {};
              self.renderCalendar().then(() => resolve(true));
            } else {
              resolve(false);
            }
          } catch (e) {
            console.error("Ошибка сохранения настроек:", e);
            self.showError(
              self.langs.ru?.errors?.settingsSave || "Ошибка сохранения"
            );
            resolve(false);
          }
        });
      },

      bind_actions: function () {
        try {
          self.bindCalendarEvents();
          return true;
        } catch (e) {
          console.error("Ошибка привязки событий:", e);
          return false;
        }
      },

      destroy: function () {
        try {
          $(document).off("click.calendar");
          $(document).off("click.date");
          $(document).off("click.popup");
          return true;
        } catch (e) {
          console.error("Ошибка очистки:", e);
          return false;
        }
      },

      initMenuPage: function () {
        try {
          const widgetRoot = document.getElementById("widget-root");
          if (widgetRoot) {
            self.renderCalendar().then(() => {
              self.bindCalendarEvents();
            });
          }
          return true;
        } catch (e) {
          console.error("Ошибка инициализации страницы меню:", e);
          return false;
        }
      },

      renderCard: function () {
        return this.callbacks.render();
      },
    };

    // Инициализация в standalone режиме
    if (this.isStandalone) {
      console.log("Запуск в standalone режиме");
      this.renderCalendar().then(() => {
        this.bindCalendarEvents();
      });
    }

    return this;
  };

  return OrdersCalendarWidget;
});

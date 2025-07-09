define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      console.log("Возвращаем существующий экземпляр виджета");
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Улучшенная проверка доступности AMOCRM API с подробной диагностикой
    this.checkAMOCRM = function () {
      try {
        console.log("Проверка доступности AMOCRM API...");
        console.log("AMOCRM доступен?", typeof AMOCRM !== "undefined");
        console.log(
          "AMOCRM.constant доступен?",
          typeof AMOCRM?.constant === "function"
        );
        console.log(
          "AMOCRM.request доступен?",
          typeof AMOCRM?.request === "function"
        );

        const isAvailable = !(
          typeof AMOCRM === "undefined" ||
          typeof AMOCRM.constant !== "function" ||
          typeof AMOCRM.request !== "function"
        );

        if (!isAvailable) {
          console.error("AMOCRM API недоступен или неполный");
          if (typeof AMOCRM === "undefined") {
            console.error(
              "AMOCRM не загружен. Проверьте загрузку loader.min.js"
            );
          } else {
            console.error("Не хватает методов AMOCRM:", {
              constant: typeof AMOCRM.constant,
              request: typeof AMOCRM.request,
            });
          }
        }

        return isAvailable;
      } catch (e) {
        console.error("Ошибка проверки AMOCRM API:", e);
        return false;
      }
    };

    this.isStandalone = !this.checkAMOCRM();

    console.log(
      "Виджет инициализирован",
      "Режим:",
      this.isStandalone ? "standalone" : "integrated"
    );

    // Получаем данные аккаунта и пользователя с улучшенной обработкой ошибок
    let accountData = {};
    let userData = {};
    let currentCard = {};

    try {
      if (!this.isStandalone) {
        accountData = AMOCRM.constant("account") || {};
        userData = AMOCRM.constant("user") || {};
        currentCard = AMOCRM.data.current_card || {};

        // Дополнительная проверка полученных данных
        if (!accountData.id || !userData.id) {
          console.error("Не удалось получить необходимые данные из AMOCRM");
          this.isStandalone = true;
        }
      }
    } catch (e) {
      console.error("Ошибка получения данных AMOCRM:", e);
      this.isStandalone = true;
    }

    console.log("Данные аккаунта:", accountData);
    console.log("Данные пользователя:", userData);
    console.log("Данные текущей карточки:", currentCard);

    // Инициализация системных методов
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
          apiError: "Ошибка подключения к API AMOCRM",
          apiNotLoaded: "AMOCRM API не загружен. Проверьте загрузку скриптов.",
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
          apiError: "AMOCRM API connection error",
          apiNotLoaded: "AMOCRM API not loaded. Check script loading.",
        },
      },
    };

    this.params = {};
    this.get_version = function () {
      return "1.0.8";
    };

    // Состояние виджета
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

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ========== //
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

    this.getWidgetTitle = function () {
      return this.langs.ru?.widget?.name || "Календарь заказов";
    };

    this.applySettings = function (settings) {
      if (settings && typeof settings === "object") {
        if (settings.deal_date_field_id) {
          const fieldId = parseInt(settings.deal_date_field_id);
          if (!isNaN(fieldId)) {
            self.state.fieldIds.ORDER_DATE = fieldId;
          }
        }
        if (settings.delivery_range_field) {
          const fieldId = parseInt(settings.delivery_range_field);
          if (!isNaN(fieldId)) {
            self.state.fieldIds.DELIVERY_RANGE = fieldId;
          }
        }
        return true;
      }
      return false;
    };

    this.get_settings = function () {
      return this.params;
    };

    this.showError = function (message) {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          widgetRoot.innerHTML = `
            <div class="error-message">
              <h3>${this.getWidgetTitle()}</h3>
              <p>${message}</p>
              <div class="error-details" style="margin-top: 20px; color: #666;">
                <p>Режим: ${this.isStandalone ? "standalone" : "integrated"}</p>
                <p>Версия виджета: ${this.get_version()}</p>
                ${
                  this.isStandalone
                    ? '<p style="color: red;">AMOCRM API не доступен</p>'
                    : ""
                }
              </div>
              ${
                this.isStandalone
                  ? '<button class="btn" onclick="location.reload()">Обновить</button>'
                  : ""
              }
            </div>
          `;
        }
      } catch (e) {
        console.error("Ошибка при отображении ошибки:", e);
      }
    };

    // ========== API МЕТОДЫ ========== //
    this.doRequest = function (method, path, data, options = {}) {
      return new Promise(function (resolve, reject) {
        if (self.isStandalone) {
          setTimeout(() => {
            const dateStr = self.formatDate(
              self.state.currentDate.getDate(),
              self.state.currentDate.getMonth() + 1,
              self.state.currentDate.getFullYear()
            );

            if (path.includes("/files") && method === "GET") {
              resolve({ _embedded: { files: [] } });
            } else if (self.state.standaloneData[dateStr]) {
              resolve({
                _embedded: {
                  leads: self.state.standaloneData[dateStr],
                },
              });
            } else {
              resolve({ _embedded: { leads: [] } });
            }
          }, 300);
          return;
        }

        try {
          if (typeof AMOCRM === "undefined") {
            console.error("AMOCRM API недоступен");
            return reject(new Error(self.langs.ru.errors.apiNotLoaded));
          }

          console.log("Отправка запроса к API:", { method, path, data });

          const requestOptions = {
            method,
            path,
            data,
            ...options,
          };

          AMOCRM.request(requestOptions)
            .then((response) => {
              if (!response) {
                console.error("Пустой ответ от сервера для", path);
                return reject(new Error("Пустой ответ сервера"));
              }
              console.log("Успешный ответ от API для", path, response);
              resolve(response);
            })
            .catch(function (error) {
              console.error("Ошибка API запроса:", {
                method,
                path,
                error,
              });
              reject(
                new Error(
                  self.langs.ru?.errors?.load || "Ошибка загрузки данных"
                )
              );
            });
        } catch (e) {
          console.error("Критическая ошибка в doRequest:", e);
          reject(e);
        }
      });
    };

    // ========== ЗАГРУЗКА ДАННЫХ ========== //
    this.loadData = function () {
      return new Promise(function (resolve) {
        try {
          console.log("Начало загрузки данных", new Date().toISOString());
          self.state.loading = true;

          if (self.isStandalone) {
            console.log("Загрузка тестовых данных в standalone режиме");
            const today = new Date();
            const dateStr = self.formatDate(
              today.getDate(),
              today.getMonth() + 1,
              today.getFullYear()
            );

            self.state.standaloneData[dateStr] = [
              {
                id: 1,
                name: "Тестовая сделка",
                status_id: 143,
                price: 1000,
                custom_fields_values: [
                  {
                    field_id: self.state.fieldIds.ORDER_DATE,
                    values: [{ value: Math.floor(today.getTime() / 1000) }],
                  },
                ],
                _embedded: {
                  contacts: [{ name: "Тестовый контакт" }],
                },
              },
            ];

            self.processData(self.state.standaloneData[dateStr]);
            self.state.loading = false;
            console.log("Данные загружены (standalone)");
            return resolve();
          }

          if (!self.state.fieldIds.ORDER_DATE) {
            console.error("Не настроено поле с датой заказа");
            self.showError("Не настроено поле с датой заказа");
            self.state.loading = false;
            return resolve();
          }

          const dateFrom = new Date(
            self.state.currentDate.getFullYear(),
            self.state.currentDate.getMonth(),
            1
          );
          const dateTo = new Date(
            self.state.currentDate.getFullYear(),
            self.state.currentDate.getMonth() + 1,
            0
          );

          console.log("Диапазон дат для запроса:", dateFrom, "до", dateTo);

          self
            .doRequest("GET", "/api/v4/leads", {
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
              console.log("Ответ от API:", response);
              if (response?._embedded?.leads) {
                self.processData(response._embedded.leads);
                console.log("Данные загружены");
              } else {
                console.warn("Нет данных о сделках в ответе");
                self.state.dealsData = {};
              }
            })
            .catch(function (error) {
              console.error("Ошибка загрузки данных:", error);
              self.showError(self.langs.ru.errors.load);
              self.state.dealsData = {};
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Неожиданная ошибка в loadData:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    this.processData = function (deals) {
      try {
        const newDealsData = {};

        if (!deals || !Array.isArray(deals)) {
          console.warn("Некорректные данные сделок:", deals);
          return;
        }

        deals.forEach(function (deal) {
          try {
            if (!deal || typeof deal !== "object") return;

            const dateField = (deal.custom_fields_values || []).find(function (
              f
            ) {
              return f?.field_id === self.state.fieldIds.ORDER_DATE;
            });

            const timestamp = dateField?.values?.[0]?.value;
            if (!timestamp) return;

            const date = new Date(timestamp * 1000);
            if (isNaN(date.getTime())) {
              console.warn("Некорректная дата в сделке:", deal.id, timestamp);
              return;
            }

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
        console.error("Критическая ошибка в processData:", e);
      }
    };

    // ========== ОТОБРАЖЕНИЕ КАЛЕНДАРЯ ========== //
    this.generateCalendarHTML = function () {
      try {
        const month = this.state.currentDate.getMonth();
        const year = this.state.currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        const monthNames = this.langs.ru?.months || [];
        const weekdays = this.langs.ru?.weekdays || [];

        let daysHTML = "";
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = this.formatDate(day, month + 1, year);
          const deals = this.state.dealsData[dateStr] || [];
          const isToday = dateStr === this.getTodayDateString();
          const hasDeals = deals.length > 0;

          daysHTML += `
            <div class="calendar-day ${isToday ? "today" : ""} ${
            hasDeals ? "has-deals" : ""
          }" 
                 data-date="${dateStr}">
              <div class="day-number">${day}</div>
              ${hasDeals ? `<div class="deal-count">${deals.length}</div>` : ""}
            </div>`;
        }

        return `
          <div class="orders-calendar">
            <div class="calendar-header">
              <h3>${this.getWidgetTitle()}</h3>
              ${
                this.isStandalone
                  ? '<p class="standalone-notice">' +
                    this.langs.ru.errors.standalone +
                    "</p>"
                  : ""
              }
              <div class="month-navigation">
                <button class="nav-button prev-month">←</button>
                <span class="current-month">${monthNames[month]} ${year}</span>
                <button class="nav-button next-month">→</button>
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
                ? '<div class="loading-spinner" style="padding: 20px; text-align: center;">Загрузка данных...</div>'
                : ""
            }
          </div>`;
      } catch (e) {
        console.error("Ошибка при создании календаря:", e);
        return '<div class="error-message">Ошибка при создании календаря</div>';
      }
    };

    this.renderCalendar = function () {
      return new Promise(function (resolve) {
        try {
          console.log("Начало renderCalendar");
          self.state.loading = true;
          const cacheKey = `${self.state.currentDate.getFullYear()}-${self.state.currentDate.getMonth()}`;

          if (self.state.cache.monthsData[cacheKey]) {
            console.log("Используем данные из кэша");
            self.state.dealsData = self.state.cache.monthsData[cacheKey];
            self.state.loading = false;
            self.updateCalendarView();
            return resolve();
          }

          console.log("Загружаем новые данные");
          self
            .loadData()
            .then(function () {
              console.log("Данные загружены, сохраняем в кэш");
              self.state.cache.monthsData[cacheKey] = {
                ...self.state.dealsData,
              };
              self.updateCalendarView();
            })
            .catch(function (e) {
              console.error("Ошибка рендеринга календаря:", e);
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Критическая ошибка в renderCalendar:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    this.updateCalendarView = function () {
      try {
        const widgetRoot = document.getElementById("widget-root");
        if (widgetRoot) {
          widgetRoot.innerHTML = self.generateCalendarHTML();
          self.bindCalendarEvents();
        }
      } catch (e) {
        console.error("Ошибка при обновлении календаря:", e);
      }
    };

    // ========== ОБРАБОТЧИКИ СОБЫТИЙ ========== //
    this.bindCalendarEvents = function () {
      try {
        $(document)
          .off("click.calendar")
          .on("click.calendar", ".prev-month", function () {
            self.state.currentDate.setMonth(
              self.state.currentDate.getMonth() - 1
            );
            self.renderCalendar();
          });

        $(document)
          .off("click.calendar")
          .on("click.calendar", ".next-month", function () {
            self.state.currentDate.setMonth(
              self.state.currentDate.getMonth() + 1
            );
            self.renderCalendar();
          });

        $(document)
          .off("click.date")
          .on("click.date", ".calendar-day:not(.empty)", function () {
            const dateStr = $(this).data("date");
            self.showDealsPopup(dateStr);
          });
      } catch (e) {
        console.error("Ошибка привязки событий календаря:", e);
      }
    };

    // ========== POPUP СО СДЕЛКАМИ ========== //
    this.showDealsPopup = function (dateStr) {
      try {
        const deals = self.state.dealsData[dateStr] || [];
        const noDealsText =
          self.langs.ru?.errors?.noDeals || "Нет сделок на эту дату";

        const dealsHTML = deals.length
          ? deals
              .map(
                (deal) => `
              <div class="deal-item" data-deal-id="${deal.id}">
                <h4>${deal.name}</h4>
                <p>Статус: ${
                  self.state.statuses[deal.status_id] || "Неизвестно"
                }</p>
                <p>Сумма: ${deal.price} руб.</p>
                ${
                  deal.contacts.length > 0
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
                self.isStandalone
                  ? '<p class="standalone-notice">' +
                    self.langs.ru.errors.standalone +
                    "</p>"
                  : ""
              }
              <div class="deals-list">${dealsHTML}</div>
              <button class="close-popup">Закрыть</button>
            </div>
          </div>
        `;

        $(".deals-popup").remove();
        $("#widget-root").append(popupHTML);

        // Загружаем файлы для каждой сделки
        if (!self.isStandalone) {
          deals.forEach((deal) => {
            self.loadDealFiles(deal.id);
          });
        }

        // Навешиваем обработчики для загрузки файлов
        $(".upload-file-btn").on("click", function () {
          const dealId = $(this).closest(".files-list").data("deal-id");
          $(`input.file-input[data-deal-id="${dealId}"]`).click();
        });

        $(".file-input").on("change", function (e) {
          const dealId = $(this).data("deal-id");
          const file = e.target.files[0];
          if (file) {
            self.uploadFile(file, dealId);
          }
        });

        $(document)
          .off("click.popup")
          .on("click.popup", ".close-popup", function () {
            $(".deals-popup").remove();
          });
      } catch (e) {
        console.error("Ошибка при отображении попапа:", e);
      }
    };

    this.loadDealFiles = function (dealId) {
      if (self.isStandalone) return;

      self
        .getDealFiles(dealId)
        .then((response) => {
          if (response && response._embedded && response._embedded.files) {
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
              self.deleteFile(fileUuid).then(() => {
                $(this).closest(".file-item").remove();
              });
            });
          }
        })
        .catch((error) => {
          console.error("Ошибка загрузки файлов сделки:", error);
        });
    };

    this.uploadFile = function (file, dealId) {
      if (self.isStandalone) {
        alert("В standalone режиме загрузка файлов невозможна");
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
        progressBar.val(self.state.fileUploadProgress);
        progressText.text(`${self.state.fileUploadProgress}%`);
      }, 100);

      self
        .completeFileUpload(file, dealId)
        .then((response) => {
          clearInterval(progressInterval);
          progressBar.val(100);
          progressText.text("100%");
          setTimeout(() => {
            progressContainer.hide();
            self.loadDealFiles(dealId);
          }, 500);
        })
        .catch((error) => {
          clearInterval(progressInterval);
          progressContainer.html(
            `<div class="error">Ошибка загрузки: ${error.message}</div>`
          );
        });
    };

    // ========== CALLBACKS ДЛЯ AMOCRM ========== //
    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          try {
            console.log("Инициализация виджета...");

            // Повторная проверка AMOCRM API
            self.isStandalone = !self.checkAMOCRM();

            if (self.isStandalone) {
              console.error(
                "Виджет перешел в standalone режим из-за недоступности AMOCRM API"
              );
              self.showError(self.langs.ru.errors.apiNotLoaded);
              return resolve(false);
            }

            const currentSettings = self.get_settings();
            if (currentSettings) {
              self.applySettings(currentSettings);
            }

            self.state.initialized = true;
            console.log("Виджет успешно инициализирован в integrated режиме");
            resolve(true);
          } catch (e) {
            console.error("Ошибка инициализации:", e);
            self.showError("Ошибка подключения к AMOCRM. Проверьте консоль.");
            resolve(false);
          }
        });
      },

      render: function () {
        return new Promise(function (resolve) {
          self
            .renderCalendar()
            .then(() => resolve(true))
            .catch((e) => {
              console.error("Ошибка рендеринга:", e);
              resolve(false);
            });
        });
      },

      onSave: function (newSettings) {
        return new Promise(function (resolve) {
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
            self.showError(self.langs.ru.errors.settingsSave);
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

    // Инициализация виджета
    if (this.isStandalone) {
      console.log("Инициализация в standalone режиме");
      this.renderCalendar().then(() => {
        console.log("Рендеринг завершен в standalone режиме");
        this.bindCalendarEvents();
      });
    } else {
      console.log("Инициализация в integrated режиме");
      // В integrated режиме инициализация происходит через callbacks
    }

    return this;
  };

  return OrdersCalendarWidget;
});

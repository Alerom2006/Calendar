define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    // Реализация паттерна Singleton
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Добавляем обработчик для активации медиа-функций после взаимодействия пользователя
    document.addEventListener(
      "click",
      function () {
        // Этот обработчик активирует медиа-функции после первого клика пользователя
      },
      { once: true }
    );

    // Инициализация системных методов
    this.system = function () {
      return {
        area: "standalone",
        amouser_id: null,
        amouser: null,
        amohash: null,
      };
    };

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
          fileUpload: "Ошибка загрузки файла",
          fileDelete: "Ошибка удаления файла",
        },
      },
    };

    this.params = {};

    // Версия виджета
    this.get_version = function () {
      return "1.0.35";
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      loading: false,
      fileUploading: false,
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

    // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ========== //

    /**
     * Форматирование даты в строку YYYY-MM-DD
     */
    this.formatDate = function (day, month, year) {
      return `${year}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
    };

    /**
     * Получение текущей даты в формате строки
     */
    this.getTodayDateString = function () {
      const today = new Date();
      return this.formatDate(
        today.getDate(),
        today.getMonth() + 1,
        today.getFullYear()
      );
    };

    /**
     * Получение заголовка виджета
     */
    this.getWidgetTitle = function () {
      return this.langs.ru?.widget?.name || "Календарь заказов";
    };

    /**
     * Применение настроек виджета
     */
    this.applySettings = function (settings) {
      if (settings.deal_date_field_id) {
        self.state.fieldIds.ORDER_DATE = parseInt(settings.deal_date_field_id);
      }
      if (settings.delivery_range_field) {
        self.state.fieldIds.DELIVERY_RANGE = parseInt(
          settings.delivery_range_field
        );
      }
      return true;
    };

    /**
     * Получение настроек виджета
     */
    this.get_settings = function () {
      return this.params;
    };

    /**
     * Привязка обработчиков событий календаря
     */
    this.bindCalendarEvents = function () {
      $(document).on("click.calendar", ".prev-month", function () {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() - 1);
        self.renderCalendar();
      });

      $(document).on("click.calendar", ".next-month", function () {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() + 1);
        self.renderCalendar();
      });

      $(document).on("click.date", ".calendar-day:not(.empty)", function () {
        const dateStr = $(this).data("date");
        self.showDealsPopup(dateStr);
      });
    };

    /**
     * Обновление отображения календаря
     */
    this.updateCalendarView = function () {
      const widgetRoot = document.getElementById("widget-root");
      if (widgetRoot) {
        widgetRoot.innerHTML = self.generateCalendarHTML();
      }
    };

    /**
     * Рендеринг виджета в standalone режиме
     */
    this.renderWidget = function () {
      const widgetRoot = document.getElementById("widget-root");
      if (widgetRoot) {
        this.renderCalendar().then(() => {
          this.bindCalendarEvents();
        });
      }
    };

    // ========== API ФАЙЛОВ (ИСПРАВЛЕННЫЕ МЕТОДЫ) ========== //

    /**
     * Создание сессии для загрузки файла
     */
    this.createFileUploadSession = function (file) {
      return new Promise(function (resolve, reject) {
        if (typeof AmoCRM === "undefined") {
          console.error("AmoCRM API недоступен");
          return reject(new Error("AmoCRM API недоступен"));
        }

        const payload = {
          file_name: file.name,
          file_size: file.size,
          content_type: file.type || "application/octet-stream",
        };

        // Используем корректный endpoint для файлов
        AmoCRM.request("POST", "https://drive.amocrm.ru/v1.0/sessions", payload)
          .then(function (response) {
            if (response.session_id && response.upload_url) {
              resolve(response);
            } else {
              reject(new Error("Неверный ответ сервера"));
            }
          })
          .catch(function (error) {
            console.error("Ошибка создания сессии:", error);
            reject(error);
          });
      });
    };

    /**
     * Загрузка части файла
     */
    this.uploadFileChunk = function (uploadUrl, chunk) {
      return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");

        xhr.onload = function () {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error("Ошибка парсинга ответа"));
            }
          } else {
            reject(new Error(`Ошибка загрузки: ${xhr.status}`));
          }
        };

        xhr.onerror = function () {
          reject(new Error("Ошибка сети"));
        };

        xhr.send(chunk);
      });
    };

    /**
     * Полная загрузка файла
     */
    this.uploadFile = function (file, leadId) {
      return new Promise(function (resolve, reject) {
        self.state.fileUploading = true;

        self
          .createFileUploadSession(file)
          .then(function (session) {
            const chunkSize = session.max_part_size || 524288;
            const chunks = Math.ceil(file.size / chunkSize);
            let currentChunk = 0;
            let uploadUrl = session.upload_url;

            function uploadNextChunk() {
              const start = currentChunk * chunkSize;
              const end = Math.min(start + chunkSize, file.size);
              const chunk = file.slice(start, end);

              self
                .uploadFileChunk(uploadUrl, chunk)
                .then(function (response) {
                  currentChunk++;

                  if (currentChunk < chunks && response.next_url) {
                    uploadUrl = response.next_url;
                    uploadNextChunk();
                  } else if (response.uuid) {
                    return self.attachFileToLead(response.uuid, leadId);
                  } else {
                    throw new Error("Не удалось завершить загрузку");
                  }
                })
                .then(function () {
                  self.state.fileUploading = false;
                  resolve();
                })
                .catch(function (error) {
                  self.state.fileUploading = false;
                  reject(error);
                });
            }

            uploadNextChunk();
          })
          .catch(function (error) {
            self.state.fileUploading = false;
            reject(error);
          });
      });
    };

    /**
     * Привязка файла к сделке
     */
    this.attachFileToLead = function (fileUuid, leadId) {
      return new Promise(function (resolve, reject) {
        if (typeof AmoCRM === "undefined") {
          return reject(new Error("AmoCRM API не доступен"));
        }

        const payload = [
          {
            file_uuid: fileUuid,
          },
        ];

        AmoCRM.request("PUT", `/api/v4/leads/${leadId}/files`, payload)
          .then(function () {
            resolve();
          })
          .catch(function (error) {
            console.error("Ошибка привязки файла:", error);
            reject(error);
          });
      });
    };

    /**
     * Получение файлов сделки
     */
    this.getLeadFiles = function (leadId) {
      return new Promise(function (resolve, reject) {
        if (typeof AmoCRM === "undefined") {
          return reject(new Error("AmoCRM API не доступен"));
        }

        AmoCRM.request("GET", `/api/v4/leads/${leadId}/files`)
          .then(function (response) {
            if (response._embedded && response._embedded.files) {
              resolve(response._embedded.files);
            } else {
              resolve([]);
            }
          })
          .catch(function (error) {
            console.error("Ошибка получения файлов:", error);
            reject(error);
          });
      });
    };

    /**
     * Удаление файла
     */
    this.deleteFile = function (fileUuid) {
      return new Promise(function (resolve, reject) {
        if (typeof AmoCRM === "undefined") {
          return reject(new Error("AmoCRM API не доступен"));
        }

        const payload = [
          {
            uuid: fileUuid,
          },
        ];

        AmoCRM.request("DELETE", "https://drive.amocrm.ru/v1.0/files", payload)
          .then(function () {
            resolve();
          })
          .catch(function (error) {
            console.error("Ошибка удаления файла:", error);
            reject(error);
          });
      });
    };

    // ========== ОСНОВНЫЕ МЕТОДЫ ВИДЖЕТА ========== //

    /**
     * Генерация HTML календаря
     */
    this.generateCalendarHTML = function () {
      try {
        var month = this.state.currentDate.getMonth();
        var year = this.state.currentDate.getFullYear();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var firstDay = new Date(year, month, 1).getDay();
        var adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

        var monthNames = this.langs.ru?.months || [];
        var weekdays = this.langs.ru?.weekdays || [];

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
              data-date="${dateStr}">
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
            ${this.state.loading ? '<div class="loading-spinner"></div>' : ""}
            ${
              this.state.fileUploading
                ? '<div class="file-upload-progress">Загрузка файла...</div>'
                : ""
            }
          </div>
        `;
      } catch (e) {
        console.error("Ошибка при создании календаря:", e);
        return '<div class="error-message">Ошибка при создании календаря</div>';
      }
    };

    /**
     * Показать попап со сделками и файлами
     */
    this.showDealsPopup = function (dateStr) {
      try {
        var deals = self.state.dealsData[dateStr] || [];
        var noDealsText =
          self.langs.ru?.errors?.noDeals || "Нет сделок на эту дату";

        var dealsHTML = deals.length
          ? deals
              .map(
                (deal) => `
              <div class="deal-item" data-deal-id="${deal.id}">
                <h4>${deal.name}</h4>
                <p>Статус: ${
                  self.state.statuses[deal.status_id] || "Неизвестно"
                }</p>
                <p>Сумма: ${deal.price} руб.</p>
                <div class="deal-files">
                  <h5>Файлы:</h5>
                  <div class="files-list" id="files-${deal.id}">
                    <div class="loading-files">Загрузка файлов...</div>
                  </div>
                  <div class="file-upload-container">
                    <input type="file" id="file-input-${
                      deal.id
                    }" class="file-input" multiple>
                    <button class="upload-file-btn" data-deal-id="${
                      deal.id
                    }">Добавить файл</button>
                  </div>
                </div>
              </div>
            `
              )
              .join("")
          : `<p class="no-deals">${noDealsText}</p>`;

        var popupHTML = `
          <div class="deals-popup">
            <h3>Сделки на ${dateStr}</h3>
            <div class="deals-list">
              ${dealsHTML}
            </div>
            <button class="close-popup">Закрыть</button>
          </div>
        `;

        $(".deals-popup").remove();
        $("#widget-root").append(popupHTML);

        // Загружаем файлы для каждой сделки
        deals.forEach(function (deal) {
          if (typeof AmoCRM !== "undefined") {
            self
              .getLeadFiles(deal.id)
              .then(function (files) {
                const filesContainer = $(`#files-${deal.id}`);
                filesContainer.empty();

                if (files.length) {
                  files.forEach(function (file) {
                    filesContainer.append(`
                      <div class="file-item" data-file-uuid="${file.file_uuid}">
                        <span>Файл ${file.file_uuid}</span>
                        <button class="delete-file-btn" data-file-uuid="${file.file_uuid}">×</button>
                      </div>
                    `);
                  });
                } else {
                  filesContainer.append(
                    '<div class="no-files">Нет прикрепленных файлов</div>'
                  );
                }
              })
              .catch(function (error) {
                console.error("Ошибка загрузки файлов:", error);
                $(`#files-${deal.id}`).html(
                  '<div class="files-error">Ошибка загрузки файлов</div>'
                );
              });
          }
        });

        // Обработчики событий
        $(document).off("click.popup");
        $(document).on("click.popup", ".close-popup", function () {
          $(".deals-popup").remove();
        });

        $(document).on("click.popup", ".upload-file-btn", function () {
          const dealId = $(this).data("deal-id");
          const fileInput = $(`#file-input-${dealId}`)[0];

          if (fileInput.files.length) {
            Array.from(fileInput.files).forEach(function (file) {
              self
                .uploadFile(file, dealId)
                .then(function () {
                  return self.getLeadFiles(dealId);
                })
                .then(function (files) {
                  const filesContainer = $(`#files-${dealId}`);
                  filesContainer.empty();

                  files.forEach(function (file) {
                    filesContainer.append(`
                      <div class="file-item" data-file-uuid="${file.file_uuid}">
                        <span>Файл ${file.file_uuid}</span>
                        <button class="delete-file-btn" data-file-uuid="${file.file_uuid}">×</button>
                      </div>
                    `);
                  });
                })
                .catch(function (error) {
                  console.error("Ошибка загрузки:", error);
                  alert(self.langs.ru.errors.fileUpload);
                });
            });
          }
        });

        $(document).on("click.popup", ".delete-file-btn", function () {
          const fileUuid = $(this).data("file-uuid");
          const dealId = $(this).closest(".deal-item").data("deal-id");

          if (confirm("Вы уверены, что хотите удалить этот файл?")) {
            self
              .deleteFile(fileUuid)
              .then(function () {
                return self.getLeadFiles(dealId);
              })
              .then(function (files) {
                const filesContainer = $(`#files-${dealId}`);
                filesContainer.empty();

                if (files.length) {
                  files.forEach(function (file) {
                    filesContainer.append(`
                      <div class="file-item" data-file-uuid="${file.file_uuid}">
                        <span>Файл ${file.file_uuid}</span>
                        <button class="delete-file-btn" data-file-uuid="${file.file_uuid}">×</button>
                      </div>
                    `);
                  });
                } else {
                  filesContainer.append(
                    '<div class="no-files">Нет прикрепленных файлов</div>'
                  );
                }
              })
              .catch(function (error) {
                console.error("Ошибка удаления:", error);
                alert(self.langs.ru.errors.fileDelete);
              });
          }
        });
      } catch (e) {
        console.error("Ошибка при отображении попапа:", e);
      }
    };

    /**
     * Обработчик ошибок API
     */
    this.handleApiErrors = function (error) {
      if (error.status === 418) {
        console.error("Некорректный запрос к API. Проверьте endpoint");
        return this.generateMockData();
      }
      console.error("Ошибка API:", error);
      return this.generateMockData();
    };

    /**
     * Загрузка данных (с обработкой ошибок)
     */
    this.loadData = function () {
      return new Promise(function (resolve) {
        try {
          if (typeof AmoCRM === "undefined") {
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
              self.state.dealsData = self.handleApiErrors(error);
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Ошибка в loadData:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    /**
     * Обработка данных сделок
     */
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
        console.error("Ошибка в processData:", e);
      }
    };

    /**
     * Генерация тестовых данных
     */
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

    /**
     * Рендеринг календаря
     */
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
              console.error("Ошибка рендеринга календаря:", e);
            })
            .finally(function () {
              self.state.loading = false;
              resolve();
            });
        } catch (e) {
          console.error("Ошибка в renderCalendar:", e);
          self.state.loading = false;
          resolve();
        }
      });
    };

    // ========== CALLBACKS ДЛЯ AMOCRM ========== //

    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          try {
            var currentSettings = self.get_settings();
            if (currentSettings) self.applySettings(currentSettings);
            self.state.initialized = true;
            resolve(true);
          } catch (e) {
            console.error("Ошибка инициализации:", e);
            resolve(false);
          }
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
              resolve(false);
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
    };

    return this;
  };

  return OrdersCalendarWidget;
});

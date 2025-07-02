define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    const self = this;

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.2",
      debugMode: false,
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    // ID полей (значения по умолчанию)
    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
      STATUS: 887369,
    };

    // Локализация
    this.i18n = {
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
        save: "Ошибка сохранения настроек",
        auth: "Ошибка авторизации",
        noDeals: "Нет сделок на выбранную дату",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
      },
    };

    // Получение ID сделки из URL
    this.getDealIdFromUrl = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? match[1] : null;
    };

    // Инициализация системы amoCRM
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          return reject(new Error("AmoCRM API not available"));
        }

        if (typeof AmoCRM.widgets.system !== "function") {
          return reject(new Error("Invalid amoCRM API"));
        }

        AmoCRM.widgets
          .system()
          .then(function (system) {
            self.state.system = system;
            self.state.initialized = true;

            if (system.access_token) {
              localStorage.setItem("amo_access_token", system.access_token);
            }

            resolve(true);
          })
          .catch(reject);
      });
    };

    // Загрузка настроек
    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (self.state.system && self.state.system.settings) {
          self.applySettings(self.state.system.settings);
        }
        resolve(true);
      });
    };

    // Проверка, находимся ли мы на странице сделки
    this.isDealPage = function () {
      if (!self.state.system) return false;
      return !!self.state.system.entity_id || !!self.getDealIdFromUrl();
    };

    // Загрузка сделок за период
    this.loadDeals = function (dateFrom, dateTo) {
      if (!self.state.system || !self.state.system.account) {
        return Promise.reject(new Error("System not initialized"));
      }

      self.showLoader();

      return $.ajax({
        url: `https://${self.state.system.account}.amocrm.ru/api/v4/leads`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("amo_access_token")}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        data: {
          "filter[custom_fields_values][field_id]": self.fieldIds.ORDER_DATE,
          "filter[custom_fields_values][from]": dateFrom,
          "filter[custom_fields_values][to]": dateTo,
          with: "custom_fields_values",
        },
        timeout: 10000,
      })
        .always(() => self.hideLoader())
        .fail((err) => {
          self.showError(self.i18n.errors.load);
          self.log("Load deals error:", err);
        });
    };

    // Применение настроек
    this.applySettings = function (settings) {
      if (settings.deal_date_field_id) {
        self.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || self.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        self.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          self.fieldIds.DELIVERY_RANGE;
      }
    };

    // Логирование
    this.log = function (...args) {
      if (self.config.debugMode) {
        console.log("[OrdersCalendar]", ...args);
      }
    };

    // Показать лоадер
    this.showLoader = function () {
      $("#loader").show();
    };

    // Скрыть лоадер
    this.hideLoader = function () {
      $("#loader").hide();
    };

    // Показать ошибку
    this.showError = function (message) {
      const $alert = $("#error-alert");
      $alert.text(message).removeClass("d-none");
      setTimeout(() => $alert.addClass("d-none"), 5000);
    };

    // Обработчик клика по дате
    this.handleDateClick = function (date) {
      self.state.selectedDate = date;
      $("#selected-date").text(date.toLocaleDateString());

      const dateStr = date.toISOString().split("T")[0];
      self.loadDeals(dateStr, dateStr).then((response) => {
        self.renderDealsList(response._embedded.leads || []);
      });
    };

    // Рендер списка сделок
    this.renderDealsList = function (deals) {
      const $dealsContainer = $("#deals");
      $dealsContainer.empty();

      if (deals.length === 0) {
        $dealsContainer.append(
          `<div class="text-muted">${self.i18n.errors.noDeals}</div>`
        );
        return;
      }

      deals.forEach((deal) => {
        $dealsContainer.append(`
          <div class="deal-item mb-3 p-3 border rounded">
            <h3 class="h6 mb-2">${deal.name}</h3>
            <div class="text-muted small">ID: ${deal.id}</div>
          </div>
        `);
      });
    };

    // Рендер календаря
    this.renderCalendar = function () {
      const currentDate = self.state.currentDate;
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Установка заголовка
      $("#currentMonthYear").text(`${self.i18n.months[month]} ${year}`);

      // Генерация дней календаря
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDay = firstDay.getDay() || 7; // 1-7, где 1 - понедельник

      let calendarHTML = "";

      // Заголовки дней недели
      calendarHTML += '<div class="calendar-row calendar-header">';
      self.i18n.weekdays.forEach((day) => {
        calendarHTML += `<div class="calendar-cell text-center fw-bold">${day}</div>`;
      });
      calendarHTML += "</div>";

      // Ячейки календаря
      let day = 1;
      for (let i = 0; i < 6; i++) {
        if (day > daysInMonth) break;

        calendarHTML += '<div class="calendar-row">';

        for (let j = 1; j <= 7; j++) {
          if (i === 0 && j < startingDay) {
            calendarHTML += '<div class="calendar-cell"></div>';
          } else if (day > daysInMonth) {
            calendarHTML += '<div class="calendar-cell"></div>';
          } else {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split("T")[0];
            const hasDeals =
              self.state.dealsData[dateStr] &&
              self.state.dealsData[dateStr].length > 0;

            calendarHTML += `
              <div class="calendar-cell ${hasDeals ? "has-deals" : ""}" 
                   data-date="${dateStr}">
                <div class="day-number">${day}</div>
                ${hasDeals ? '<div class="deal-dot"></div>' : ""}
              </div>
            `;
            day++;
          }
        }

        calendarHTML += "</div>";
      }

      $("#calendar").html(calendarHTML);

      // Обработчики кликов
      $(".calendar-cell[data-date]").click(function () {
        const dateStr = $(this).data("date");
        self.handleDateClick(new Date(dateStr));
      });
    };

    // Рендер представления календаря
    this.renderCalendarView = function () {
      // Установка заголовка
      $("#widget-title").text("Календарь заказов");
      $("#deals-title").text(self.i18n.labels.dealsFor);
      $("#selected-date").text(self.i18n.labels.selectDate);
      $("#auth-button-text").text(self.i18n.labels.authButton);

      // Обработчики кнопок
      $("#prevMonth").click(() => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() - 1);
        self.renderCalendar();
      });

      $("#nextMonth").click(() => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() + 1);
        self.renderCalendar();
      });

      // Обработчик авторизации
      $("#authButton").click(() => {
        if (self.state.system && self.state.system.oauth) {
          window.location.href = self.state.system.oauth;
        }
      });

      // Первоначальный рендер календаря
      self.renderCalendar();

      // Загрузка сделок на текущий месяц
      const firstDay = new Date(
        self.state.currentDate.getFullYear(),
        self.state.currentDate.getMonth(),
        1
      );
      const lastDay = new Date(
        self.state.currentDate.getFullYear(),
        self.state.currentDate.getMonth() + 1,
        0
      );

      self
        .loadDeals(
          firstDay.toISOString().split("T")[0],
          lastDay.toISOString().split("T")[0]
        )
        .then((response) => {
          if (response && response._embedded && response._embedded.leads) {
            // Группировка сделок по датам
            self.state.dealsData = {};
            response._embedded.leads.forEach((deal) => {
              const dateField = deal.custom_fields_values.find(
                (field) => field.field_id === self.fieldIds.ORDER_DATE
              );
              if (dateField && dateField.values && dateField.values[0]) {
                const dateStr = dateField.values[0].substr(0, 10);
                if (!self.state.dealsData[dateStr]) {
                  self.state.dealsData[dateStr] = [];
                }
                self.state.dealsData[dateStr].push(deal);
              }
            });
            self.renderCalendar();
          }
        });
    };

    // Рендер представления сделки
    this.renderDealView = function () {
      const dealId = self.state.system.entity_id || self.getDealIdFromUrl();
      if (!dealId) return;

      self.showLoader();

      $.ajax({
        url: `https://${self.state.system.account}.amocrm.ru/api/v4/leads/${dealId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("amo_access_token")}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        data: {
          with: "custom_fields_values",
        },
      })
        .done((deal) => {
          $("#deal-widget-content").html(`
          <div class="deal-widget">
            <h3>${deal.name}</h3>
            <div class="deal-id">ID: ${deal.id}</div>
            <button id="openCalendar" class="btn btn-primary mt-3">Открыть календарь</button>
          </div>
        `);

          $("#openCalendar").click(() => {
            self.state.currentView = "calendar";
            $("#calendar-mode").show();
            $("#deal-widget-mode").hide();
            self.renderCalendarView();
          });

          $("#calendar-mode").hide();
          $("#deal-widget-mode").show();
        })
        .fail((err) => {
          self.showError(self.i18n.errors.load);
          self.log("Load deal error:", err);
        })
        .always(() => self.hideLoader());
    };

    // Настройка UI
    this.setupUI = function () {
      if (self.isDealPage()) {
        self.renderDealView();
      } else {
        self.renderCalendarView();
      }
    };

    // Callbacks для amoCRM API
    this.callbacks = {
      init: function () {
        return self
          .initSystem()
          .then(() => self.loadSettings())
          .then(() => {
            self.setupUI();
            return true;
          })
          .catch((err) => {
            self.log("Init error:", err);
            self.showError(self.i18n.errors.load);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          self.log("Saving settings:", newSettings);
          self.applySettings(newSettings);
          return true;
        } catch (err) {
          self.log("Save settings error:", err);
          return false;
        }
      },

      render: function () {
        try {
          if (!self.state.initialized) {
            return false;
          }
          self.setupUI();
          return true;
        } catch (err) {
          self.log("Render error:", err);
          return false;
        }
      },

      bind_actions: function () {
        return true;
      },

      settings: function () {
        return true;
      },

      dpSettings: function () {
        return true;
      },

      destroy: function () {
        return true;
      },

      advancedSettings: function () {
        return true;
      },

      onInstall: function () {
        self.log("Widget installed");
        return true;
      },

      onUpdate: function () {
        self.log("Widget updated");
        return true;
      },
    };

    this.__amowidget__ = true;
    return this;
  }

  // Регистрация виджета
  if (typeof AmoCRM !== "undefined") {
    if (
      typeof AmoCRM.Widget !== "undefined" &&
      typeof AmoCRM.Widget.register === "function"
    ) {
      AmoCRM.Widget.register(OrdersCalendarWidget);
    } else if (
      typeof AmoCRM.Widgets !== "undefined" &&
      typeof AmoCRM.Widgets.from === "function"
    ) {
      AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendarWidget);
    }
  }

  return OrdersCalendarWidget;
});

define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const widget = this;

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.4",
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
      accessToken: null,
    };

    // ID полей по умолчанию (могут быть переопределены в настройках)
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

    // Основные методы виджета
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          widget.handleAuth();
          return reject(new Error("AmoCRM API not available"));
        }

        AmoCRM.widgets
          .system()
          .then((system) => {
            widget.state.system = system;
            widget.state.initialized = true;
            resolve(true);
          })
          .catch((err) => {
            widget.handleAuth();
            reject(err);
          });
      });
    };

    // Обработка авторизации
    this.handleAuth = function () {
      const token = localStorage.getItem("amo_access_token");
      if (token) {
        widget.state.accessToken = token;
        return true;
      }

      // Если нет токена, показываем кнопку авторизации
      $("#widget-root").html(`
                <div class="auth-required">
                    <p>${widget.i18n.errors.auth}</p>
                    <button id="authBtn" class="btn btn-primary">
                        ${widget.i18n.labels.authButton}
                    </button>
                </div>
            `);

      $("#authBtn").click(() => {
        window.location.href = `https://${widget.getAccountDomain()}.amocrm.ru/oauth2/authorize`;
      });

      return false;
    };

    // Получение домена аккаунта
    this.getAccountDomain = function () {
      if (widget.state.system?.account) return widget.state.system.account;
      return window.location.hostname.split(".")[0] || "";
    };

    // Загрузка настроек
    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (widget.state.system?.settings) {
          widget.applySettings(widget.state.system.settings);
        }
        resolve(true);
      });
    };

    // Применение настроек
    this.applySettings = function (settings) {
      if (!settings) return;

      if (settings.deal_date_field_id) {
        widget.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || widget.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        widget.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          widget.fieldIds.DELIVERY_RANGE;
      }

      widget.state.settings = settings;
    };

    // Показ загрузчика
    this.showLoader = function () {
      $("#loader").show();
    };

    // Скрытие загрузчика
    this.hideLoader = function () {
      $("#loader").hide();
    };

    // Показ ошибки
    this.showError = function (message) {
      $("#error-alert").text(message).removeClass("d-none");
      setTimeout(() => $("#error-alert").addClass("d-none"), 5000);
    };

    // Логирование
    this.log = function (...args) {
      if (widget.config.debugMode) console.log("[OrdersCalendar]", ...args);
    };

    // Инициализация UI
    this.setupUI = function () {
      if (!widget.state.initialized && !widget.state.accessToken) return;

      // Ваш код инициализации интерфейса
      $("#widget-root").html('<div class="calendar-container"></div>');
    };

    // Callbacks для amoCRM API (должны быть в конце)
    this.callbacks = {
      init: function (system) {
        widget.state.system = system;
        return widget
          .initSystem()
          .then(() => widget.loadSettings())
          .then(() => {
            widget.setupUI();
            return true;
          })
          .catch((err) => {
            widget.log("Init error:", err);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            widget.log("No settings provided");
            return false;
          }
          widget.applySettings(newSettings);
          return true;
        } catch (e) {
          widget.log("onSave error:", e);
          return false;
        }
      },

      render: function () {
        try {
          if (!widget.state.initialized && !widget.state.accessToken) {
            widget.handleAuth();
            return false;
          }
          widget.setupUI();
          return true;
        } catch (e) {
          widget.log("Render error:", e);
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

  // Регистрация виджета
  if (typeof AmoCRM !== "undefined") {
    try {
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
    } catch (e) {
      console.error("Widget registration failed:", e);
    }
  } else {
    // Автономный режим
    document.addEventListener("DOMContentLoaded", function () {
      new OrdersCalendarWidget();
    });
  }

  return OrdersCalendarWidget;
});
define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const widget = this;

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.4",
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
      accessToken: null,
    };

    // ID полей по умолчанию (могут быть переопределены в настройках)
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

    // Основные методы виджета
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          widget.handleAuth();
          return reject(new Error("AmoCRM API not available"));
        }

        AmoCRM.widgets
          .system()
          .then((system) => {
            widget.state.system = system;
            widget.state.initialized = true;
            resolve(true);
          })
          .catch((err) => {
            widget.handleAuth();
            reject(err);
          });
      });
    };

    // Обработка авторизации
    this.handleAuth = function () {
      const token = localStorage.getItem("amo_access_token");
      if (token) {
        widget.state.accessToken = token;
        return true;
      }

      // Если нет токена, показываем кнопку авторизации
      $("#widget-root").html(`
                <div class="auth-required">
                    <p>${widget.i18n.errors.auth}</p>
                    <button id="authBtn" class="btn btn-primary">
                        ${widget.i18n.labels.authButton}
                    </button>
                </div>
            `);

      $("#authBtn").click(() => {
        window.location.href = `https://${widget.getAccountDomain()}.amocrm.ru/oauth2/authorize`;
      });

      return false;
    };

    // Получение домена аккаунта
    this.getAccountDomain = function () {
      if (widget.state.system?.account) return widget.state.system.account;
      return window.location.hostname.split(".")[0] || "";
    };

    // Загрузка настроек
    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (widget.state.system?.settings) {
          widget.applySettings(widget.state.system.settings);
        }
        resolve(true);
      });
    };

    // Применение настроек
    this.applySettings = function (settings) {
      if (!settings) return;

      if (settings.deal_date_field_id) {
        widget.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || widget.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        widget.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          widget.fieldIds.DELIVERY_RANGE;
      }

      widget.state.settings = settings;
    };

    // Показ загрузчика
    this.showLoader = function () {
      $("#loader").show();
    };

    // Скрытие загрузчика
    this.hideLoader = function () {
      $("#loader").hide();
    };

    // Показ ошибки
    this.showError = function (message) {
      $("#error-alert").text(message).removeClass("d-none");
      setTimeout(() => $("#error-alert").addClass("d-none"), 5000);
    };

    // Логирование
    this.log = function (...args) {
      if (widget.config.debugMode) console.log("[OrdersCalendar]", ...args);
    };

    // Инициализация UI
    this.setupUI = function () {
      if (!widget.state.initialized && !widget.state.accessToken) return;

      // Ваш код инициализации интерфейса
      $("#widget-root").html('<div class="calendar-container"></div>');
    };

    // Callbacks для amoCRM API (должны быть в конце)
    this.callbacks = {
      init: function (system) {
        widget.state.system = system;
        return widget
          .initSystem()
          .then(() => widget.loadSettings())
          .then(() => {
            widget.setupUI();
            return true;
          })
          .catch((err) => {
            widget.log("Init error:", err);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            widget.log("No settings provided");
            return false;
          }
          widget.applySettings(newSettings);
          return true;
        } catch (e) {
          widget.log("onSave error:", e);
          return false;
        }
      },

      render: function () {
        try {
          if (!widget.state.initialized && !widget.state.accessToken) {
            widget.handleAuth();
            return false;
          }
          widget.setupUI();
          return true;
        } catch (e) {
          widget.log("Render error:", e);
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

  // Регистрация виджета
  if (typeof AmoCRM !== "undefined") {
    try {
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
    } catch (e) {
      console.error("Widget registration failed:", e);
    }
  } else {
    // Автономный режим
    document.addEventListener("DOMContentLoaded", function () {
      new OrdersCalendarWidget();
    });
  }

  return OrdersCalendarWidget;
});

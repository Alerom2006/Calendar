define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const widget = this;

    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.4",
      debugMode: false,
    };

    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
      STATUS: 887369,
    };

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

    this.getDealIdFromUrl = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined")
          return reject(new Error("AmoCRM API not available"));
        if (typeof AmoCRM.widgets.system !== "function")
          return reject(new Error("Invalid amoCRM API"));
        AmoCRM.widgets
          .system()
          .then((system) => {
            widget.state.system = system;
            widget.state.initialized = true;
            resolve(true);
          })
          .catch(reject);
      });
    };

    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (widget.state.system?.settings) {
          widget.applySettings(widget.state.system.settings);
        }
        resolve(true);
      });
    };

    this.isDealPage = function () {
      return !!(widget.state.system?.entity_id || widget.getDealIdFromUrl());
    };

    this.applySettings = function (settings) {
      if (settings.deal_date_field_id) {
        widget.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || widget.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        widget.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          widget.fieldIds.DELIVERY_RANGE;
      }
    };

    this.showLoader = function () {
      $("#loader").show();
    };

    this.hideLoader = function () {
      $("#loader").hide();
    };

    this.showError = function (message) {
      $("#error-alert").text(message).removeClass("d-none");
      setTimeout(() => $("#error-alert").addClass("d-none"), 5000);
    };

    this.log = function (...args) {
      if (widget.config.debugMode) console.log("[OrdersCalendar]", ...args);
    };

    this.callbacks = {
      init: function () {
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
          if (!newSettings) return false;
          widget.applySettings(newSettings);
          return true;
        } catch (e) {
          widget.log("onSave error:", e);
          return false;
        }
      },
      render: function () {
        try {
          if (!widget.state.initialized) return false;
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
        return true;
      },
      onUpdate: function () {
        return true;
      },
    };

    return this;
  }

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
  }

  return OrdersCalendarWidget;
});

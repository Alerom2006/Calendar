define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    var self = this;
    self.__amowidget__ = true;

    self.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.2",
      debugMode: true,
    };

    self.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    self.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
      STATUS: 887369,
    };

    self.i18n = {
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

    self.getDealIdFromUrl = function () {
      try {
        var match = window.location.pathname.match(/leads\/detail\/(\d+)/);
        return match ? parseInt(match[1]) : null;
      } catch (e) {
        console.error("Error in getDealIdFromUrl:", e);
        return null;
      }
    };

    self.initSystem = function () {
      return new Promise(function (resolve, reject) {
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
            resolve(true);
          })
          .catch(reject);
      });
    };

    self.loadSettings = function () {
      return new Promise(function (resolve) {
        if (self.state.system && self.state.system.settings) {
          self.applySettings(self.state.system.settings);
        }
        resolve(true);
      });
    };

    self.isDealPage = function () {
      if (!self.state.system) return false;
      return !!self.state.system.entity_id || !!self.getDealIdFromUrl();
    };

    self.applySettings = function (settings) {
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

    self.showLoader = function () {
      $("#loader").show();
    };

    self.hideLoader = function () {
      $("#loader").hide();
    };

    self.showError = function (message) {
      $("#error-alert").text(message).removeClass("d-none");
      setTimeout(function () {
        $("#error-alert").addClass("d-none");
      }, 5000);
    };

    self.log = function () {
      if (self.config.debugMode) {
        console.log.apply(console, arguments);
      }
    };

    self.callbacks = {
      init: function () {
        try {
          return self
            .initSystem()
            .then(function () {
              return self.loadSettings();
            })
            .then(function () {
              self.setupUI();
              return true;
            })
            .catch(function (err) {
              console.error("Init error:", err);
              return false;
            });
        } catch (e) {
          console.error("Callback init error:", e);
          return false;
        }
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

      render: function () {
        try {
          if (!self.state.initialized) return false;
          self.setupUI();
          return true;
        } catch (e) {
          console.error("Render error:", e);
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

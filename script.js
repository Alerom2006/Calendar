define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    const self = this;

    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.2",
      debugMode: false,
    };

    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
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
      },
    };

    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          self.log("AmoCRM API not available");
          return reject(new Error("AmoCRM API not available"));
        }

        if (typeof AmoCRM.widgets.system !== "function") {
          self.log("AmoCRM.widgets.system is not a function");
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

    this.loadSettings = function () {
      return new Promise((resolve) => {
        resolve(true);
      });
    };

    this.isDealPage = function () {
      if (!self.state.system) return false;

      if (self.state.system.entity_id) {
        return true;
      }

      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return !!match;
    };

    this.loadDeals = function (dateFrom, dateTo) {
      if (!self.state.system || !self.state.system.account) {
        return Promise.reject(new Error("System not initialized"));
      }

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
      });
    };

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
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          self.log("Saving settings:", newSettings);

          if (!newSettings || typeof newSettings !== "object") {
            throw new Error("Invalid settings format");
          }

          self.state.settings = newSettings;
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

    this.log = function (...args) {
      if (self.config.debugMode) {
        console.log("[OrdersCalendar]", ...args);
      }
    };

    this.setupUI = function () {
      if (self.isDealPage()) {
        self.renderDealView();
      } else {
        self.renderCalendarView();
      }
    };

    return {
      __amowidget__: true,
      callbacks: self.callbacks,

      init: self.callbacks.init,
      onSave: self.callbacks.onSave,
      render: self.callbacks.render,

      _widget: self,
    };
  }

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

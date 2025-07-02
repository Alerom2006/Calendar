define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    var self = this; // Изменил const на var для совместимости

    // Все свойства и методы объявляем в начале
    this.__amowidget__ = true; // Добавил явно в начало

    // Конфигурация
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.2",
      debugMode: true, // Включил debugMode для логов
    };

    // Состояние
    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    // ID полей
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

    // Все методы виджета
    this.getDealIdFromUrl = function () {
      try {
        var match = window.location.pathname.match(/leads\/detail\/(\d+)/);
        return match ? match[1] : null;
      } catch (e) {
        this.log("Error in getDealIdFromUrl:", e);
        return null;
      }
    };

    // ... (все остальные методы остаются без изменений) ...

    // Callbacks должны быть объявлены в самом конце
    this.callbacks = {
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
              self.log("Init error:", err);
              return false;
            });
        } catch (e) {
          self.log("Callback init error:", e);
          return false;
        }
      },

      onSave: function (newSettings) {
        try {
          self.log("onSave called with:", newSettings);
          if (!newSettings) {
            self.log("No settings provided");
            return false;
          }

          self.applySettings(newSettings);
          return true;
        } catch (e) {
          self.log("onSave error:", e);
          return false;
        }
      },

      render: function () {
        try {
          if (!self.state.initialized) {
            self.log("Widget not initialized in render");
            return false;
          }
          self.setupUI();
          return true;
        } catch (e) {
          self.log("Render error:", e);
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
  }

  return OrdersCalendarWidget;
});

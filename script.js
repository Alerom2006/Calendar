define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    // Сохраняем контекст виджета
    const widget = this;
    this.__amowidget__ = true;

    // 1. ИНИЦИАЛИЗАЦИЯ ВИДЖЕТА
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.6",
      debugMode: false,
    };

    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentDate: new Date(),
    };

    // 2. ОСНОВНЫЕ МЕТОДЫ
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined")
          return reject("AmoCRM API not available");

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

    this.applySettings = function (settings) {
      if (!settings) return;
      widget.state.settings = settings;
      // Применяем настройки полей
    };

    // 3. CALLBACK-ФУНКЦИИ ДЛЯ AMOCRM (должны быть в конце)
    this.callbacks = {
      init: function () {
        return widget
          .initSystem()
          .then(() => true)
          .catch((err) => {
            console.error("Init error:", err);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          widget.applySettings(newSettings);
          return true;
        } catch (e) {
          console.error("Save error:", e);
          return false;
        }
      },

      render: function () {
        try {
          if (!widget.state.initialized) return false;
          // Инициализация UI
          return true;
        } catch (e) {
          console.error("Render error:", e);
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

  // 4. РЕГИСТРАЦИЯ ВИДЖЕТА
  if (typeof AmoCRM !== "undefined") {
    try {
      if (typeof AmoCRM.Widget !== "undefined") {
        AmoCRM.Widget.register(OrdersCalendarWidget);
      } else if (typeof AmoCRM.Widgets !== "undefined") {
        AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendarWidget);
      }
    } catch (e) {
      console.error("Registration failed:", e);
    }
  }

  return OrdersCalendarWidget;
});

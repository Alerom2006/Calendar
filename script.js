define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    // Фиксируем контекст виджета
    const widget = this;

    // Явно указываем, что это виджет amoCRM
    widget.__amowidget__ = true;

    // Состояние виджета
    widget.state = {
      initialized: false,
      settings: {},
    };

    // Метод для применения настроек
    widget.applySettings = function (settings) {
      try {
        if (!settings) return false;
        widget.state.settings = settings;
        return true;
      } catch (e) {
        console.error("ApplySettings error:", e);
        return false;
      }
    };

    // Callbacks для amoCRM API
    widget.callbacks = {
      // Основной callback, вызываемый при сохранении
      onSave: function (newSettings) {
        try {
          console.log("onSave triggered with:", newSettings);
          return widget.applySettings(newSettings);
        } catch (e) {
          console.error("onSave execution error:", e);
          return false;
        }
      },

      // Инициализация виджета
      init: function () {
        return new Promise((resolve) => {
          widget.state.initialized = true;
          resolve(true);
        });
      },

      // Отрисовка виджета
      render: function () {
        return widget.state.initialized;
      },

      // Дополнительные обязательные callbacks
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
    };

    return widget;
  }

  // Безопасная регистрация виджета
  if (typeof AmoCRM !== "undefined") {
    try {
      // Современный способ регистрации
      if (typeof AmoCRM.Widgets?.from === "function") {
        AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendarWidget);
      }
      // Старый способ для обратной совместимости
      else if (typeof AmoCRM.Widget?.register === "function") {
        AmoCRM.Widget.register(OrdersCalendarWidget);
      }
    } catch (e) {
      console.error("Widget registration failed:", e);
    }
  }

  return OrdersCalendarWidget;
});

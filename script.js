define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    // Фиксируем контекст виджета
    const widget = this;

    // Базовые настройки виджета
    widget.__amowidget__ = true;
    widget.version = "1.0.3";

    // Состояние виджета
    widget.state = {
      initialized: false,
      settingsLoaded: false,
    };

    // Метод сохранения настроек (исправленная версия)
    widget.applySettings = function (settings) {
      try {
        if (!settings) return false;

        // Сохраняем настройки
        widget.settings = settings;
        widget.state.settingsLoaded = true;

        return true;
      } catch (e) {
        console.error("Settings apply error:", e);
        return false;
      }
    };

    // Callbacks для amoCRM API
    widget.callbacks = {
      onSave: function (newSettings) {
        // Прямой вызов без использования this._widget
        return widget.applySettings(newSettings);
      },

      init: function () {
        return new Promise((resolve) => {
          widget.state.initialized = true;
          resolve(true);
        });
      },

      render: function () {
        return widget.state.initialized;
      },
    };

    return widget;
  }

  // Безопасная регистрация виджета
  if (typeof AmoCRM !== "undefined") {
    try {
      if (
        typeof AmoCRM.Widgets === "object" &&
        typeof AmoCRM.Widgets.from === "function"
      ) {
        AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendarWidget);
      }
    } catch (e) {
      console.error("Widget registration error:", e);
    }
  }

  return OrdersCalendarWidget;
});

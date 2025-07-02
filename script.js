define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    // Сохраняем контекст виджета
    var widgetInstance = this;

    // Все свойства через widgetInstance
    widgetInstance.__amowidget__ = true;
    widgetInstance.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.2",
      debugMode: true,
    };

    widgetInstance.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    widgetInstance.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
      STATUS: 887369,
    };

    // Основные методы виджета
    widgetInstance.applySettings = function (settings) {
      if (settings.deal_date_field_id) {
        widgetInstance.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) ||
          widgetInstance.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        widgetInstance.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          widgetInstance.fieldIds.DELIVERY_RANGE;
      }
    };

    // Callbacks с прямым доступом к widgetInstance
    widgetInstance.callbacks = {
      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            console.error("No settings provided");
            return false;
          }
          // Прямой вызов без this._widget
          widgetInstance.applySettings(newSettings);
          return true;
        } catch (e) {
          console.error("onSave error:", e);
          return false;
        }
      },

      init: function () {
        return widgetInstance
          .initSystem()
          .then(function () {
            return widgetInstance.loadSettings();
          })
          .then(function () {
            widgetInstance.setupUI();
            return true;
          })
          .catch(function (err) {
            console.error("Init error:", err);
            return false;
          });
      },

      render: function () {
        try {
          if (!widgetInstance.state.initialized) return false;
          widgetInstance.setupUI();
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

    // Остальные методы виджета...

    return widgetInstance;
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

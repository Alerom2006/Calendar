define(["jquery"], function ($) {
  "use strict";

  // 1. Основной конструктор виджета
  function OrdersCalendar() {
    // Сохраняем контекст
    const self = this;

    // 2. Конфигурация виджета
    this.widgetConfig = {
      instanceId: "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      isInitialized: false,
    };

    // 3. Инициализация системы amoCRM
    this.initSystem = function () {
      return new Promise((resolve) => {
        if (window.AmoCRM && AmoCRM.widgets && AmoCRM.widgets.system) {
          AmoCRM.widgets
            .system()
            .then(function (system) {
              self.system = system;
              self.widgetConfig.isInitialized = true;
              resolve(true);
            })
            .catch(() => resolve(false));
        } else {
          // Режим разработки (без amoCRM)
          self.system = {
            account: "spacebakery1",
            entity_id: null,
          };
          resolve(true);
        }
      });
    };

    // 4. Объект callbacks ДОЛЖЕН быть объявлен как свойство экземпляра
    this.callbacks = {
      init: function () {
        return self.initSystem().then((success) => {
          if (!success) return false;

          // Здесь может быть ваша дополнительная инициализация
          return true;
        });
      },

      onSave: function (newSettings) {
        try {
          console.log("Received settings:", newSettings);

          // Ваша логика обработки настроек
          if (newSettings) {
            // Сохраняем настройки
            self.settings = newSettings;

            // Вызываем метод applySettings если он существует
            if (typeof self.applySettings === "function") {
              self.applySettings(newSettings);
            }

            return true;
          }
          return false;
        } catch (e) {
          console.error("Save settings error:", e);
          return false;
        }
      },

      // Обязательные пустые callback-и
      render: function () {
        return true;
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
    };

    // 5. Возвращаем специальный объект для amoCRM
    const widgetInterface = {
      // Обязательное свойство для идентификации
      __amowidget__: true,

      // Основные callback-и
      init: this.callbacks.init,
      onSave: this.callbacks.onSave,
      render: this.callbacks.render,

      // Ссылка на основной объект для отладки
      _widget: this,
    };

    return widgetInterface;
  }

  // 6. Явная регистрация виджета в системе amoCRM
  if (window.AmoCRM && AmoCRM.Widget && AmoCRM.Widget.register) {
    AmoCRM.Widget.register(OrdersCalendar);
  } else if (window.AmoCRM && AmoCRM.Widgets && AmoCRM.Widgets.from) {
    AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendar);
  }

  return OrdersCalendar;
});

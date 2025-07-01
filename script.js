define(["jquery"], function ($) {
  // 1. Основной конструктор
  function OrdersCalendar() {
    // Сохраняем контекст
    const self = this;

    // 2. Конфигурация
    this.config = {
      widgetInstanceId: "orders-calendar-" + Date.now(),
      FIELD_IDS: {
        ORDER_DATE: 885453,
        DELIVERY_RANGE: 892009,
        EXACT_TIME: 892003,
        ADDRESS: 887367,
      },
    };

    // 3. Инициализация системы
    this.initSystem = function () {
      return new Promise((resolve) => {
        if (
          typeof AmoCRM !== "undefined" &&
          AmoCRM.widgets &&
          AmoCRM.widgets.system
        ) {
          AmoCRM.widgets
            .system()
            .then(function (system) {
              self.system = system;
              resolve(true);
            })
            .catch(resolve);
        } else {
          // Режим разработки без amoCRM
          self.system = {
            account: "spacebakery1",
            entity_id: null,
          };
          resolve(true);
        }
      });
    };

    // 4. Callbacks для amoCRM
    const callbacks = {
      init: function () {
        return self
          .initSystem()
          .then(() => {
            self.loadSettings();
            self.setupUI();
            return true;
          })
          .catch(() => false);
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) return false;

          // Сохраняем настройки
          self.settings = newSettings;

          // Перерисовываем виджет
          if (self.renderCalendar) {
            self.renderCalendar();
          }

          return true;
        } catch (e) {
          console.error("Save error:", e);
          return false;
        }
      },

      // Обязательные пустые callback-и
      render: () => true,
      bind_actions: () => true,
      settings: () => true,
      dpSettings: () => true,
      destroy: () => true,
    };

    // 5. Возвращаем специальный объект для amoCRM
    return {
      callbacks: callbacks,
      __amowidget__: true, // Важно для идентификации виджета

      // Публичные методы
      init: callbacks.init,
      onSave: callbacks.onSave,
    };
  }

  // 6. Регистрация виджета
  if (typeof AmoCRM !== "undefined" && AmoCRM.Widgets) {
    AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendar);
  }

  return OrdersCalendar;
});

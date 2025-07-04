(function () {
  "use strict";

  // Проверяем окружение
  const isAMD = typeof define === "function" && define.amd;
  const isStandalone = !isAMD && typeof window !== "undefined";

  // Основной конструктор виджета
  function OrdersCalendarWidget() {
    if (!(this instanceof OrdersCalendarWidget)) {
      return new OrdersCalendarWidget();
    }

    var self = this; // Сохраняем контекст для использования в колбэках

    // Состояние виджета
    this.state = {
      initialized: false,
      currentDate: new Date(),
      dealsData: {},
      fieldIds: {
        ORDER_DATE: 885453,
      },
      statuses: {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      },
    };

    // Автобайндинг методов
    this.handleDateClick = this.handleDateClick.bind(this);
    this.handleMonthNavigation = this.handleMonthNavigation.bind(this);

    // Методы виджета
    this.init = function () {
      return this.loadData()
        .then(() => this.renderCalendar())
        .catch((error) => {
          console.error("Ошибка инициализации:", error);
          this.showError();
        });
    };

    this.handleDateClick = function (dateStr, event) {
      try {
        event.stopPropagation();

        if (typeof AmoCRM !== "undefined") {
          AmoCRM.router.navigate({
            leads: {
              filter: {
                [this.state.fieldIds.ORDER_DATE]: {
                  from: Math.floor(new Date(dateStr).getTime() / 1000),
                  to: Math.floor(new Date(dateStr).getTime() / 1000 + 86399),
                },
              },
            },
          });
        } else {
          this.showDealsPopup(dateStr);
        }
      } catch (error) {
        console.error("Ошибка обработки клика:", error);
      }
    };

    // ... (остальные методы остаются без изменений)

    // Функции обратного вызова для amoCRM
    this.callbacks = {
      init: function () {
        return new Promise((resolve) => {
          try {
            const widget = new OrdersCalendarWidget();
            window.widgetInstance = widget;
            resolve(true);
          } catch (error) {
            console.error("Ошибка инициализации:", error);
            resolve(false);
          }
        });
      },

      render: function () {
        return new Promise((resolve) => {
          try {
            if (window.widgetInstance) {
              window.widgetInstance.init().then(() => resolve(true));
            } else {
              new OrdersCalendarWidget().init().then(() => resolve(true));
            }
          } catch (error) {
            console.error("Ошибка рендеринга:", error);
            resolve(false);
          }
        });
      },

      onSave: function (settings) {
        try {
          // Используем сохраненный контекст
          if (self.applySettings) {
            return self.applySettings(settings);
          }
          return true;
        } catch (error) {
          console.error("Ошибка сохранения настроек:", error);
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

  // Экспорт в зависимости от окружения
  if (isAMD) {
    define([], () => OrdersCalendarWidget);
  } else if (isStandalone) {
    window.OrdersCalendarWidget = OrdersCalendarWidget;
    document.addEventListener("DOMContentLoaded", () => {
      new OrdersCalendarWidget().init();
    });
  }
})();

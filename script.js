define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // Проверка доступности AmoCRM API
    this.checkAMOCRM = function () {
      try {
        if (typeof AmoCRM === "undefined") {
          return false;
        }

        // Проверяем только необходимые методы, которые точно есть в API
        if (
          typeof AmoCRM.constant !== "function" ||
          typeof AmoCRM.data !== "object"
        ) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    };

    this.isStandalone = !this.checkAMOCRM();

    // Инициализация данных
    this.system = function () {
      return {
        area: "standalone",
        subdomain: "yourdomain",
      };
    };

    // Локализация
    this.langs = {
      ru: {
        widget: { name: "Календарь заказов" },
        errors: {
          apiNotLoaded: "AmoCRM API не загружен",
        },
      },
    };

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      dealsData: {},
    };

    // Основные методы виджета
    this.generateCalendarHTML = function () {
      return `
        <div class="orders-calendar">
          <div class="calendar-header">
            <h3>${this.langs.ru.widget.name}</h3>
          </div>
          <div class="calendar-grid">
            <div class="calendar-day">1</div>
            <!-- Остальные дни календаря -->
          </div>
        </div>`;
    };

    // Колбэки для AmoCRM
    this.callbacks = {
      init: function () {
        return new Promise(function (resolve) {
          resolve(true);
        });
      },

      render: function () {
        return new Promise(function (resolve) {
          try {
            // Важно: вызываем render_template с правильными параметрами
            if (
              !self.isStandalone &&
              typeof self.render_template === "function"
            ) {
              self.render_template(
                {
                  body: self.generateCalendarHTML(),
                  caption: {
                    class_name: "orders-calendar-caption",
                  },
                },
                {}
              );
            }
            resolve(true);
          } catch (e) {
            resolve(false);
          }
        });
      },

      bind_actions: function () {
        return true;
      },

      destroy: function () {
        return true;
      },
    };

    // Инициализация в standalone режиме
    if (this.isStandalone) {
      const widgetRoot = document.getElementById("widget-root");
      if (widgetRoot) {
        widgetRoot.innerHTML = this.generateCalendarHTML();
      }
    }

    return this;
  };

  return OrdersCalendarWidget;
});

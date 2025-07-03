define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    var self = this;
    this.__amowidget__ = true;

    // Системные переменные и локализация
    var system = self.system();
    var langs = self.langs;

    // Конфигурация виджета
    this.config = {
      debugMode: true,
      version: "1.0.5",
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
    };

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      isLoading: false,
      context: null,
      accountDomain: null,
      settings: {},
      fieldIds: {
        ORDER_DATE: 885453,
        DELIVERY_RANGE: 892009,
        EXACT_TIME: 892003,
        ADDRESS: 887367,
      },
    };

    // Локализация
    this.i18n = {
      months: langs.months || [
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
      weekdays: langs.weekdays || ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
      errors: {
        load: langs.errors?.load || "Ошибка загрузки данных",
        noDeals: langs.errors?.noDeals || "Нет сделок на выбранную дату",
        noAuth: langs.errors?.noAuth || "Требуется авторизация в amoCRM",
        settingsSave:
          langs.errors?.settingsSave || "Ошибка при сохранении настроек",
      },
      labels: {
        dealsFor: langs.labels?.dealsFor || "Сделки на",
        selectDate: langs.labels?.selectDate || "выберите дату",
        authButton: langs.labels?.authButton || "Авторизоваться в amoCRM",
        today: langs.labels?.today || "Сегодня",
        openCalendar: langs.labels?.openCalendar || "Открыть календарь",
        save: langs.labels?.save || "Сохранить",
        settingsTitle:
          langs.labels?.settingsTitle || "Настройки календаря заказов",
      },
    };

    // Основные callback-функции
    this.callbacks = {
      init: function () {
        try {
          self.state.context = self.detectContext();
          self.state.accountDomain = self.extractAccountDomain();
          self.state.settings = system.params?.settings || {};

          // Обновляем ID полей из настроек
          if (self.state.settings.deal_date_field_id) {
            self.state.fieldIds.ORDER_DATE =
              self.state.settings.deal_date_field_id;
          }
          if (self.state.settings.delivery_range_field) {
            self.state.fieldIds.DELIVERY_RANGE =
              self.state.settings.delivery_range_field;
          }

          return true;
        } catch (e) {
          console.error("Init error:", e);
          return false;
        }
      },

      render: function () {
        try {
          self.container = document.getElementById("widget-root");
          if (!self.container) {
            console.error("Widget container not found");
            return false;
          }

          // Определяем режим работы
          switch (system.location) {
            case "lcard-1":
            case "ccard-0":
              return self.initCardMode();
            case "llist-0":
            case "clist-0":
              return self.initListMode();
            case "settings":
              return self.initSettingsMode();
            default:
              return self.initStandaloneMode();
          }
        } catch (e) {
          console.error("Render error:", e);
          return false;
        }
      },

      bind_actions: function () {
        // Привязка событий после рендеринга
        return true;
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) return false;
          return self.applySettings(newSettings);
        } catch (e) {
          console.error("Save error:", e);
          return false;
        }
      },

      destroy: function () {
        // Очистка ресурсов
        try {
          $(self.container).empty();
          return true;
        } catch (e) {
          console.error("Destroy error:", e);
          return false;
        }
      },
    };

    /* ========== ОСНОВНЫЕ МЕТОДЫ ВИДЖЕТА ========== */

    // Определение контекста работы
    this.detectContext = function () {
      if (typeof AmoProxySDK !== "undefined") return "proxy_sdk";
      if (typeof AmoSDK !== "undefined") return "card_sdk";
      if (typeof AmoCRM !== "undefined") return "widget";
      if (system.location === "settings") return "settings";
      return "standalone";
    };

    // Получение домена аккаунта
    this.extractAccountDomain = function () {
      if (system.account) return system.account;
      if (system.params?.account) return system.params.account;
      return window.location.hostname.split(".")[0] || "";
    };

    // Применение настроек
    this.applySettings = function (newSettings) {
      try {
        self.state.settings = newSettings;

        // Обновляем ID полей
        if (newSettings.deal_date_field_id) {
          self.state.fieldIds.ORDER_DATE = newSettings.deal_date_field_id;
        }
        if (newSettings.delivery_range_field) {
          self.state.fieldIds.DELIVERY_RANGE = newSettings.delivery_range_field;
        }

        self.showMessage(langs.labels?.settingsSaved || "Настройки сохранены");
        return true;
      } catch (e) {
        console.error("Apply settings error:", e);
        return false;
      }
    };

    // Режим карточки (компактный вид)
    this.initCardMode = function () {
      try {
        var html = `
          <div class="deal-widget-mode">
            <h3>${langs.widget?.name || "Календарь заказов"}</h3>
            <div class="deal-date">
              ${new Date().toLocaleDateString()}
            </div>
            <button id="openCalendar" class="btn">
              ${this.i18n.labels.openCalendar}
            </button>
          </div>
        `;

        $(self.container).html(html);
        $("#openCalendar").click(function () {
          self.showFullCalendar();
        });

        return true;
      } catch (e) {
        console.error("Card mode init error:", e);
        return false;
      }
    };

    // Полноэкранный календарь
    this.showFullCalendar = function () {
      try {
        var html = `
          <div class="full-calendar-view">
            <div class="calendar-header">
              <button id="prevMonth" class="btn">←</button>
              <h2 id="currentMonth"></h2>
              <button id="nextMonth" class="btn">→</button>
            </div>
            <div id="calendarGrid" class="calendar-grid"></div>
            <div class="deals-container">
              <h3>${this.i18n.labels.dealsFor} <span id="selectedDateText">${this.i18n.labels.selectDate}</span></h3>
              <div id="dealsList"></div>
            </div>
          </div>
        `;

        $(self.container).html(html);
        this.renderCalendar();
        this.bindCalendarEvents();

        return true;
      } catch (e) {
        console.error("Full calendar error:", e);
        return false;
      }
    };

    // Отрисовка календаря
    this.renderCalendar = function () {
      var month = self.state.currentDate.getMonth();
      var year = self.state.currentDate.getFullYear();
      var firstDay = new Date(year, month, 1);
      var lastDay = new Date(year, month + 1, 0);
      var startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

      // Заголовок с месяцем и годом
      $("#currentMonth").text(`${this.i18n.months[month]} ${year}`);

      // Генерация дней недели
      var calendarHtml = this.i18n.weekdays
        .map(function (day) {
          return `<div class="weekday">${day}</div>`;
        })
        .join("");

      // Пустые ячейки в начале месяца
      for (var i = 0; i < startDay; i++) {
        calendarHtml += '<div class="calendar-day empty"></div>';
      }

      // Дни месяца
      for (var day = 1; day <= lastDay.getDate(); day++) {
        var dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        var dealsCount = self.state.dealsData[dateStr]?.length || 0;
        var isToday = this.isToday(dateStr);

        var dayClass =
          "calendar-day" +
          (isToday ? " today" : "") +
          (dealsCount > 0 ? " has-deals" : "");

        calendarHtml += `
          <div class="${dayClass}" data-date="${dateStr}">
            ${day}
            ${
              dealsCount > 0
                ? `<span class="deal-count">${dealsCount}</span>`
                : ""
            }
          </div>
        `;
      }

      $("#calendarGrid").html(calendarHtml);
      $(".calendar-day:not(.empty)").click(function () {
        self.showDealsForDate($(this).data("date"));
      });

      return true;
    };

    // Показать сделки на выбранную дату
    this.showDealsForDate = function (date) {
      try {
        var deals = self.state.dealsData[date] || [];
        var dateObj = new Date(date);

        $("#selectedDateText").text(dateObj.toLocaleDateString());

        if (deals.length === 0) {
          $("#dealsList").html(
            `<div class="no-deals">${this.i18n.errors.noDeals}</div>`
          );
          return;
        }

        var dealsHtml = deals
          .map(function (deal) {
            return `
            <div class="deal-item" data-deal-id="${deal.id}">
              <div class="deal-header">
                <span class="deal-id">#${deal.id}</span>
                <span class="deal-status">${self.getStatusName(
                  deal.status_id
                )}</span>
              </div>
              <div class="deal-name">${deal.name}</div>
              <div class="deal-price">${
                deal.price ? deal.price + " руб." : "—"
              }</div>
            </div>
          `;
          })
          .join("");

        $("#dealsList").html(dealsHtml);
        $(".deal-item").click(function () {
          self.openDealCard($(this).data("deal-id"));
        });

        return true;
      } catch (e) {
        console.error("Show deals error:", e);
        return false;
      }
    };

    // Режим настроек
    this.initSettingsMode = function () {
      try {
        var html = `
          <div class="settings-form">
            <h2>${this.i18n.labels.settingsTitle}</h2>
            <div class="form-group">
              <label>${
                langs.settings?.deal_date_field_id || "ID поля даты заказа"
              }:</label>
              <input type="number" id="dealDateField" value="${
                self.state.fieldIds.ORDER_DATE
              }" class="form-control">
            </div>
            <div class="form-group">
              <label>${
                langs.settings?.delivery_range_field ||
                "ID поля диапазона доставки"
              }:</label>
              <input type="number" id="deliveryRangeField" value="${
                self.state.fieldIds.DELIVERY_RANGE
              }" class="form-control">
            </div>
            <button id="saveSettings" class="btn btn-primary">
              ${this.i18n.labels.save}
            </button>
          </div>
        `;

        $(self.container).html(html);
        $("#saveSettings").click(function () {
          self.saveCurrentSettings();
        });

        return true;
      } catch (e) {
        console.error("Settings mode error:", e);
        return false;
      }
    };

    // Сохранение текущих настроек
    this.saveCurrentSettings = function () {
      try {
        var newSettings = {
          deal_date_field_id:
            parseInt($("#dealDateField").val()) ||
            self.state.fieldIds.ORDER_DATE,
          delivery_range_field:
            parseInt($("#deliveryRangeField").val()) ||
            self.state.fieldIds.DELIVERY_RANGE,
        };

        if (typeof AmoCRM !== "undefined") {
          AmoCRM.widgets.system().then(function (system) {
            system.saveSettings(newSettings);
          });
        } else {
          self.applySettings(newSettings);
        }

        return true;
      } catch (e) {
        console.error("Save settings error:", e);
        return false;
      }
    };

    // Режим списка
    this.initListMode = function () {
      // Реализация режима списка
      return true;
    };

    // Автономный режим
    this.initStandaloneMode = function () {
      try {
        var html = `
          <div class="standalone-view">
            <h2>${langs.widget?.name || "Календарь заказов"}</h2>
            <div class="auth-section">
              <p>${this.i18n.errors.noAuth}</p>
              <button id="authButton" class="btn btn-primary">
                ${this.i18n.labels.authButton}
              </button>
            </div>
          </div>
        `;

        $(self.container).html(html);
        $("#authButton").click(function () {
          window.open(
            `https://${self.state.accountDomain}.amocrm.ru/oauth`,
            "_blank"
          );
        });

        return true;
      } catch (e) {
        console.error("Standalone mode error:", e);
        return false;
      }
    };

    // Вспомогательные методы
    this.isToday = function (dateStr) {
      var today = new Date();
      var checkDate = new Date(dateStr);
      return (
        checkDate.getDate() === today.getDate() &&
        checkDate.getMonth() === today.getMonth() &&
        checkDate.getFullYear() === today.getFullYear()
      );
    };

    this.getStatusName = function (statusId) {
      var statuses = langs.statuses || {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      };
      return statuses[statusId] || `Статус #${statusId}`;
    };

    this.openDealCard = function (dealId) {
      if (typeof AmoCRM !== "undefined") {
        AmoCRM.widgets.system().then(function (system) {
          system.openCard(dealId);
        });
      } else {
        window.open(
          `https://${self.state.accountDomain}.amocrm.ru/leads/detail/${dealId}`,
          "_blank"
        );
      }
    };

    this.showMessage = function (message) {
      var alert = $(`<div class="alert alert-success">${message}</div>`);
      $(self.container).prepend(alert);
      setTimeout(function () {
        alert.fadeOut();
      }, 3000);
    };

    this.showError = function (message) {
      var alert = $(`<div class="alert alert-danger">${message}</div>`);
      $(self.container).prepend(alert);
      setTimeout(function () {
        alert.fadeOut();
      }, 5000);
    };

    // Привязка событий календаря
    this.bindCalendarEvents = function () {
      $("#prevMonth").click(function () {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() - 1);
        self.renderCalendar();
      });

      $("#nextMonth").click(function () {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() + 1);
        self.renderCalendar();
      });
    };

    return this;
  };

  // Регистрация виджета
  if (typeof AmoWidget === "function") {
    AmoWidget({
      class: OrdersCalendarWidget,
      init: function (system) {
        this.widget = new OrdersCalendarWidget();
        return this.widget.callbacks.init();
      },
      render: function () {
        return this.widget.callbacks.render();
      },
      onSave: function (newSettings) {
        return this.widget.callbacks.onSave(newSettings);
      },
      destroy: function () {
        return this.widget.callbacks.destroy();
      },
    });
  } else {
    // Автономный режим
    document.addEventListener("DOMContentLoaded", function () {
      new OrdersCalendarWidget();
    });
  }

  return OrdersCalendarWidget;
});

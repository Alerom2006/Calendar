define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    // Сохраняем контекст
    this.__amowidget__ = true;
    var self = this;

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.5",
      debugMode: true,
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

    // Локализация (будет переопределена из i18n)
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
        noDeals: "Нет сделок на выбранную дату",
        noAuth: "Требуется авторизация в amoCRM",
        settingsSave: "Ошибка при сохранении настроек",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
        today: "Сегодня",
        openCalendar: "Открыть календарь",
        save: "Сохранить",
        settingsTitle: "Настройки календаря заказов",
      },
    };

    /* ========== ОСНОВНЫЕ МЕТОДЫ ВИДЖЕТА ========== */

    // Определение контекста работы
    this.detectContext = function () {
      if (typeof AmoProxySDK !== "undefined") return "proxy_sdk";
      if (typeof AmoSDK !== "undefined") return "card_sdk";
      if (typeof AmoCRM !== "undefined") return "widget";
      if (this.system && this.system.location === "settings") return "settings";
      return "standalone";
    };

    // Получение домена аккаунта
    this.extractAccountDomain = function () {
      if (this.system && this.system.account) return this.system.account;
      if (this.params && this.params.account) return this.params.account;
      return window.location.hostname.split(".")[0] || "";
    };

    // Применение настроек
    this.applySettings = function (newSettings) {
      try {
        self.state.settings = newSettings;

        if (newSettings.deal_date_field_id) {
          self.state.fieldIds.ORDER_DATE = newSettings.deal_date_field_id;
        }
        if (newSettings.delivery_range_field) {
          self.state.fieldIds.DELIVERY_RANGE = newSettings.delivery_range_field;
        }

        self.showMessage("Настройки применены");
        return true;
      } catch (e) {
        console.error("Apply settings error:", e);
        self.showError("Ошибка применения настроек");
        return false;
      }
    };

    // Основная инициализация
    this.initialize = function () {
      try {
        self.state.context = self.detectContext();
        self.state.accountDomain = self.extractAccountDomain();

        if (self.system && self.system.params) {
          self.state.settings = self.system.params.settings || {};
          // Обновляем ID полей из настроек
          if (self.state.settings.deal_date_field_id) {
            self.state.fieldIds.ORDER_DATE =
              self.state.settings.deal_date_field_id;
          }
          if (self.state.settings.delivery_range_field) {
            self.state.fieldIds.DELIVERY_RANGE =
              self.state.settings.delivery_range_field;
          }
        }

        return true;
      } catch (e) {
        console.error("Initialization error:", e);
        return false;
      }
    };

    // Режим карточки (компактный вид)
    this.initCardMode = function () {
      try {
        var html = `
                    <div class="deal-widget-mode">
                        <h3>Календарь заказов</h3>
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

      $("#currentMonth").text(`${this.i18n.months[month]} ${year}`);

      var calendarHtml = this.i18n.weekdays
        .map(function (day) {
          return `<div class="weekday">${day}</div>`;
        })
        .join("");

      for (var i = 0; i < startDay; i++) {
        calendarHtml += '<div class="calendar-day empty"></div>';
      }

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
                            <label>ID поля даты заказа:</label>
                            <input type="number" id="dealDateField" value="${self.state.fieldIds.ORDER_DATE}" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>ID поля диапазона доставки:</label>
                            <input type="number" id="deliveryRangeField" value="${self.state.fieldIds.DELIVERY_RANGE}" class="form-control">
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

    // Автономный режим
    this.initStandaloneMode = function () {
      try {
        var html = `
                    <div class="standalone-view">
                        <h2>Календарь заказов</h2>
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
      var statuses = {
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

    // Callbacks для amoCRM API (должны быть в конце, после всех методов)
    this.callbacks = {
      init: function (system) {
        self.system = system;
        self.container = document.getElementById("widget-root");
        return self.initialize();
      },

      render: function () {
        if (!self.container) {
          console.error("Widget container not found");
          return false;
        }

        switch (self.system.location) {
          case "lcard-1":
          case "ccard-0":
            return self.initCardMode();
          case "llist-0":
          case "clist-0":
            // Режим списка (реализуйте при необходимости)
            return true;
          case "settings":
            return self.initSettingsMode();
          default:
            return self.initStandaloneMode();
        }
      },

      bind_actions: function () {
        // Дополнительная привязка событий
        return true;
      },

      onSave: function (newSettings) {
        return self.applySettings(newSettings);
      },

      destroy: function () {
        try {
          $(self.container).empty();
          return true;
        } catch (e) {
          console.error("Destroy error:", e);
          return false;
        }
      },
    };

    return this;
  }

  // Регистрация виджета
  if (typeof AmoWidget === "function") {
    AmoWidget({
      class: OrdersCalendarWidget,
      init: function (system) {
        this.widget = new OrdersCalendarWidget();
        return this.widget.callbacks.init(system);
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

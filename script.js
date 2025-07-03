define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    // Сохраняем контекст виджета
    const widget = this;
    this.__amowidget__ = true;

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.5",
      debugMode: true,
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      isLoading: false,
    };

    // ID полей (значения по умолчанию)
    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
    };

    // Инициализация системы amoCRM
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          return reject(new Error("AmoCRM API not available"));
        }

        AmoCRM.widgets
          .system()
          .then(function (system) {
            widget.state.system = system;
            widget.state.initialized = true;
            resolve(true);
          })
          .catch(reject);
      });
    };

    // Загрузка настроек
    this.loadSettings = function () {
      return new Promise(function (resolve) {
        if (widget.state.system && widget.state.system.settings) {
          widget.applySettings(widget.state.system.settings);
        }
        resolve(true);
      });
    };

    // Применение настроек
    this.applySettings = function (settings) {
      if (settings.deal_date_field_id) {
        widget.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || widget.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        widget.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          widget.fieldIds.DELIVERY_RANGE;
      }
    };

    // Получение ID сделки из URL
    this.getDealIdFromUrl = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    // Настройка интерфейса
    this.setupUI = function () {
      $("#widget-root").html(`
        <div class="widget-container">
          <div id="calendar"></div>
          <div id="deals-container"></div>
        </div>
      `);
      widget.loadDealsData();
    };

    // Загрузка данных о сделках
    this.loadDealsData = function () {
      widget.state.isLoading = true;
      widget.showLoader();

      const dateFrom = new Date(
        widget.state.currentDate.getFullYear(),
        widget.state.currentDate.getMonth() - 1,
        1
      );
      const dateTo = new Date(
        widget.state.currentDate.getFullYear(),
        widget.state.currentDate.getMonth() + 2,
        0
      );

      const filter = {
        [widget.fieldIds.ORDER_DATE]: {
          from: Math.floor(dateFrom.getTime() / 1000),
          to: Math.floor(dateTo.getTime() / 1000),
        },
      };

      widget.state.system
        .request("/api/v4/leads", { filter })
        .then(function (response) {
          widget.processDealsData(response._embedded?.leads || []);
          widget.renderCalendar();
        })
        .catch(function (error) {
          widget.showError("Ошибка загрузки данных");
        })
        .finally(function () {
          widget.state.isLoading = false;
          widget.hideLoader();
        });
    };

    // Обработка данных о сделках
    this.processDealsData = function (deals) {
      widget.state.dealsData = {};
      deals.forEach(function (deal) {
        const dateField = deal.custom_fields_values?.find(
          (field) => field.field_id === widget.fieldIds.ORDER_DATE
        );
        if (dateField?.values?.[0]?.value) {
          const dateStr = new Date(dateField.values[0].value * 1000)
            .toISOString()
            .split("T")[0];
          if (!widget.state.dealsData[dateStr]) {
            widget.state.dealsData[dateStr] = [];
          }
          widget.state.dealsData[dateStr].push(deal);
        }
      });
    };

    // Отрисовка календаря
    this.renderCalendar = function () {
      const month = widget.state.currentDate.getMonth();
      const year = widget.state.currentDate.getFullYear();

      let calendarHTML = `
        <div class="calendar-header">
          <button class="prev-month">&lt;</button>
          <h3>${this.getMonthName(month)} ${year}</h3>
          <button class="next-month">&gt;</button>
        </div>
        <div class="calendar-grid">
      `;

      // Добавьте здесь логику отрисовки дней календаря
      // ...

      $("#calendar").html(calendarHTML);
    };

    // Получение названия месяца
    this.getMonthName = function (month) {
      const months = [
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
      ];
      return months[month];
    };

    // Показать лоадер
    this.showLoader = function () {
      $("#loader").show();
    };

    // Скрыть лоадер
    this.hideLoader = function () {
      $("#loader").hide();
    };

    // Показать ошибку
    this.showError = function (message) {
      $("#error-alert").text(message).removeClass("d-none");
      setTimeout(function () {
        $("#error-alert").addClass("d-none");
      }, 5000);
    };

    // Callback-функции (должны быть объявлены последними)
    this.callbacks = {
      init: function () {
        return widget
          .initSystem()
          .then(function () {
            return widget.loadSettings();
          })
          .then(function () {
            widget.setupUI();
            return true;
          })
          .catch(function (error) {
            console.error("Init error:", error);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            console.error("No settings provided");
            return false;
          }
          widget.applySettings(newSettings);
          return true;
        } catch (error) {
          console.error("onSave error:", error);
          return false;
        }
      },

      render: function () {
        try {
          if (!widget.state.initialized) return false;
          widget.setupUI();
          return true;
        } catch (error) {
          console.error("Render error:", error);
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
    } catch (error) {
      console.error("Widget registration failed:", error);
    }
  }

  return OrdersCalendarWidget;
});

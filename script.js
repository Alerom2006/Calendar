define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const widget = this;

    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.4",
      debugMode: true,
    };

    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
      STATUS: 887369,
    };

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
        save: "Ошибка сохранения настроек",
        auth: "Ошибка авторизации",
        noDeals: "Нет сделок на выбранную дату",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
      },
    };

    // Основные методы виджета

    this.getDealIdFromUrl = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined")
          return reject(new Error("AmoCRM API not available"));
        if (typeof AmoCRM.widgets.system !== "function")
          return reject(new Error("Invalid amoCRM API"));

        AmoCRM.widgets
          .system()
          .then((system) => {
            widget.state.system = system;
            widget.state.initialized = true;
            resolve(true);
          })
          .catch(reject);
      });
    };

    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (widget.state.system?.settings) {
          widget.applySettings(widget.state.system.settings);
        }
        resolve(true);
      });
    };

    this.isDealPage = function () {
      return !!(widget.state.system?.entity_id || widget.getDealIdFromUrl());
    };

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

    this.showLoader = function () {
      $("#loader").show();
    };

    this.hideLoader = function () {
      $("#loader").hide();
    };

    this.showError = function (message) {
      $("#error-alert").text(message).removeClass("d-none");
      setTimeout(() => $("#error-alert").addClass("d-none"), 5000);
    };

    this.log = function (...args) {
      if (widget.config.debugMode) console.log("[OrdersCalendar]", ...args);
    };

    // Методы для работы с календарем

    this.setupUI = function () {
      if (widget.isDealPage()) {
        $("#widget_container").show();
        $("#calendar-mode").hide();
        $("#deal-widget-mode").show();
        widget.renderDealWidget();
      } else {
        $("#widget_container").show();
        $("#calendar-mode").show();
        $("#deal-widget-mode").hide();
        widget.loadDealsData().then(() => widget.renderCalendar());
      }
    };

    this.loadDealsData = function () {
      return new Promise((resolve) => {
        if (!widget.state.system) return resolve();

        widget.showLoader();

        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);

        const filter = {
          filter: {
            [widget.fieldIds.ORDER_DATE]: {
              from: Math.floor(firstDay.getTime() / 1000),
              to: Math.floor(lastDay.getTime() / 1000),
            },
          },
        };

        widget.state.system
          .request("/api/v4/leads", filter)
          .then((response) => {
            widget.processDealsData(response._embedded.leads);
            resolve();
          })
          .catch((error) => {
            widget.log("Error loading deals:", error);
            widget.showError(widget.i18n.errors.load);
            resolve();
          })
          .finally(() => widget.hideLoader());
      });
    };

    this.processDealsData = function (deals) {
      widget.state.dealsData = {};

      deals.forEach((deal) => {
        const orderDateField = deal.custom_fields_values?.find(
          (field) => field.field_id === widget.fieldIds.ORDER_DATE
        );

        if (orderDateField && orderDateField.values[0].value) {
          const dateStr = new Date(orderDateField.values[0].value * 1000)
            .toISOString()
            .split("T")[0];

          if (!widget.state.dealsData[dateStr]) {
            widget.state.dealsData[dateStr] = [];
          }

          widget.state.dealsData[dateStr].push(deal);
        }
      });
    };

    this.renderCalendar = function () {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      widget.renderMonth(currentMonth, currentYear);

      $("#prevMonth").click(() => {
        widget.state.currentDate.setMonth(
          widget.state.currentDate.getMonth() - 1
        );
        widget.renderMonth(
          widget.state.currentDate.getMonth(),
          widget.state.currentDate.getFullYear()
        );
      });

      $("#nextMonth").click(() => {
        widget.state.currentDate.setMonth(
          widget.state.currentDate.getMonth() + 1
        );
        widget.renderMonth(
          widget.state.currentDate.getMonth(),
          widget.state.currentDate.getFullYear()
        );
      });
    };

    this.renderMonth = function (month, year) {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Корректировка для Пн-Вс

      $("#currentMonthYear").text(`${widget.i18n.months[month]} ${year}`);

      let calendarHTML = "";

      // Добавляем дни недели
      widget.i18n.weekdays.forEach((day) => {
        calendarHTML += `<div class="calendar-weekday">${day}</div>`;
      });

      // Добавляем пустые ячейки для первого дня месяца
      for (let i = 0; i < startingDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
      }

      // Добавляем дни месяца
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const dealsCount = widget.state.dealsData[dateStr]?.length || 0;

        calendarHTML += `
          <div class="calendar-day" data-date="${dateStr}">
            ${day}
            ${
              dealsCount > 0
                ? `<span class="deal-count">${dealsCount}</span>`
                : ""
            }
          </div>
        `;
      }

      $("#calendar").html(calendarHTML);

      $(".calendar-day:not(.empty)").click(function () {
        const date = $(this).data("date");
        widget.showDealsForDate(date);
      });
    };

    this.showDealsForDate = function (date) {
      widget.state.selectedDate = date;
      $("#selected-date").text(date);

      const deals = widget.state.dealsData[date] || [];
      let dealsHTML = "";

      if (deals.length === 0) {
        dealsHTML = `<div class="no-deals">${widget.i18n.errors.noDeals}</div>`;
      } else {
        // Сортируем сделки по ID (новые сверху)
        deals
          .sort((a, b) => b.id - a.id)
          .forEach((deal) => {
            const deliveryRange = deal.custom_fields_values?.find(
              (f) => f.field_id === widget.fieldIds.DELIVERY_RANGE
            )?.values[0]?.value;

            const exactTime = deal.custom_fields_values?.find(
              (f) => f.field_id === widget.fieldIds.EXACT_TIME
            )?.values[0]?.value;

            const address = deal.custom_fields_values?.find(
              (f) => f.field_id === widget.fieldIds.ADDRESS
            )?.values[0]?.value;

            dealsHTML += `
            <div class="deal-item" data-deal-id="${deal.id}">
              <div class="deal-id">ID: ${deal.id}</div>
              <div class="deal-name">Название: ${deal.name}</div>
              <div class="deal-price">Бюджет: ${deal.price || "—"}</div>
              <div class="deal-delivery">Диапазон доставки: ${
                deliveryRange || "—"
              }</div>
              <div class="deal-exact-time">К точному времени: ${
                exactTime ? "Да" : "Нет"
              }</div>
              <div class="deal-address">Адрес: ${address || "—"}</div>
            </div>
          `;
          });
      }

      $("#deals").html(dealsHTML);

      $(".deal-item").click(function () {
        const dealId = $(this).data("deal-id");
        widget.openDealCard(dealId);
      });
    };

    this.openDealCard = function (dealId) {
      if (widget.state.system?.openCard) {
        widget.state.system.openCard(dealId);
      } else if (window.AmoCRM?.openCard) {
        window.AmoCRM.openCard(dealId);
      } else {
        window.location.href = `/leads/detail/${dealId}`;
      }
    };

    this.renderDealWidget = function () {
      const dealId =
        widget.state.system?.entity_id || widget.getDealIdFromUrl();
      if (!dealId) return;

      widget.showLoader();

      widget.state.system
        .request(`/api/v4/leads/${dealId}`)
        .then((deal) => {
          const orderDateField = deal.custom_fields_values?.find(
            (field) => field.field_id === widget.fieldIds.ORDER_DATE
          );

          let content = '<div class="deal-widget-mode">';
          content += `<h3>Информация о заказе</h3>`;

          if (orderDateField && orderDateField.values[0].value) {
            const orderDate = new Date(orderDateField.values[0].value * 1000);
            content += `<div class="deal-date">Дата заказа: ${orderDate.toLocaleDateString()}</div>`;
          }

          content += `<button id="openCalendar" class="btn">Открыть календарь заказов</button>`;
          content += "</div>";

          $("#deal-widget-content").html(content);

          $("#openCalendar").click(() => {
            widget.state.currentView = "calendar";
            widget.setupUI();
          });
        })
        .catch((error) => {
          widget.log("Error loading deal:", error);
          $("#deal-widget-content").html(
            `<div class="error-message">${widget.i18n.errors.load}</div>`
          );
        })
        .finally(() => widget.hideLoader());
    };

    // Callbacks для amoCRM

    this.callbacks = {
      init: function () {
        return widget
          .initSystem()
          .then(() => widget.loadSettings())
          .then(() => {
            widget.setupUI();
            return true;
          })
          .catch((err) => {
            widget.log("Init error:", err);
            widget.showError(widget.i18n.errors.load);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) return false;
          widget.applySettings(newSettings);
          widget.setupUI(); // Перерисовываем виджет с новыми настройками
          return true;
        } catch (e) {
          widget.log("onSave error:", e);
          return false;
        }
      },

      render: function () {
        try {
          if (!widget.state.initialized) return false;
          widget.setupUI();
          return true;
        } catch (e) {
          widget.log("Render error:", e);
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

    return this;
  }

  // Регистрация виджета в amoCRM
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

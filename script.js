define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const widget = this; // Сохраняем контекст виджета

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.4",
      debugMode: true,
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentView: "calendar",
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      isLoading: false,
    };

    // ID полей
    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
      STATUS: 887369,
    };

    // Локализация
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
        today: "Сегодня",
        save: "Сохранить",
      },
    };

    // Инициализация системы amoCRM
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          return reject(new Error("AmoCRM API not available"));
        }

        if (typeof AmoCRM.widgets.system !== "function") {
          return reject(new Error("Invalid amoCRM API"));
        }

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

    // Загрузка настроек
    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (widget.state.system?.settings) {
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

    // Проверка страницы сделки
    this.isDealPage = function () {
      return !!(widget.state.system?.entity_id || widget.getDealIdFromUrl());
    };

    // Получение ID сделки из URL
    this.getDealIdFromUrl = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    // Загрузка данных о сделках
    this.loadDealsData = function () {
      return new Promise((resolve, reject) => {
        if (!widget.state.initialized) {
          return reject(new Error("Widget not initialized"));
        }

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
          .then((response) => {
            widget.processDealsData(response._embedded?.leads || []);
            resolve(true);
          })
          .catch((error) => {
            widget.showError(widget.i18n.errors.load);
            reject(error);
          })
          .finally(() => {
            widget.state.isLoading = false;
            widget.hideLoader();
          });
      });
    };

    // Обработка данных о сделках
    this.processDealsData = function (deals) {
      widget.state.dealsData = {};

      deals.forEach((deal) => {
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

          widget.state.dealsData[dateStr].push({
            id: deal.id,
            name: deal.name,
            price: deal.price,
            status_id: deal.status_id,
            custom_fields: {
              [widget.fieldIds.DELIVERY_RANGE]: widget.getCustomFieldValue(
                deal,
                widget.fieldIds.DELIVERY_RANGE
              ),
              [widget.fieldIds.ADDRESS]: widget.getCustomFieldValue(
                deal,
                widget.fieldIds.ADDRESS
              ),
            },
          });
        }
      });
    };

    // Получение значения кастомного поля
    this.getCustomFieldValue = function (deal, fieldId) {
      const field = deal.custom_fields_values?.find(
        (f) => f.field_id === fieldId
      );
      return field?.values?.[0]?.value || null;
    };

    // Настройка UI
    this.setupUI = function () {
      if (widget.isDealPage()) {
        widget.renderCompactView();
      } else {
        widget.renderFullView();
      }
    };

    // Рендер компактного вида
    this.renderCompactView = function () {
      $("#widget-root").html(`
        <div class="compact-view">
          <h3>Календарь заказов</h3>
          <div class="mini-calendar"></div>
          <button id="showFullCalendar" class="btn btn-primary">
            ${widget.i18n.labels.openCalendar}
          </button>
        </div>
      `);

      $("#showFullCalendar").on("click", () => widget.renderFullView());
      widget.renderMiniCalendar();
    };

    // Рендер полного вида
    this.renderFullView = function () {
      $("#widget-root").html(`
        <div class="full-view">
          <div class="calendar-controls">
            <button id="prevMonth" class="btn btn-outline-primary">←</button>
            <h2 id="currentMonthYear"></h2>
            <button id="nextMonth" class="btn btn-outline-primary">→</button>
          </div>
          <div id="calendar" class="calendar-grid"></div>
          <div class="deals-section">
            <h3>${widget.i18n.labels.dealsFor} <span id="selectedDate">${widget.i18n.labels.selectDate}</span></h3>
            <div id="deals" class="deals-container"></div>
          </div>
        </div>
      `);

      $("#prevMonth").on("click", () => widget.prevMonth());
      $("#nextMonth").on("click", () => widget.nextMonth());

      widget.loadDealsData().then(() => widget.renderCalendar());
    };

    // Рендер календаря
    this.renderCalendar = function () {
      const month = widget.state.currentDate.getMonth();
      const year = widget.state.currentDate.getFullYear();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

      $("#currentMonthYear").text(`${widget.i18n.months[month]} ${year}`);

      let calendarHTML = widget.i18n.weekdays
        .map((day) => `<div class="weekday">${day}</div>`)
        .join("");

      for (let i = 0; i < startDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
      }

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const dealsCount = widget.state.dealsData[dateStr]?.length || 0;
        const isToday = widget.isToday(dateStr);

        calendarHTML += `
          <div class="calendar-day ${isToday ? "today" : ""} ${
          dealsCount ? "has-deals" : ""
        }" 
               data-date="${dateStr}">
            ${day}${
          dealsCount ? `<span class="deal-count">${dealsCount}</span>` : ""
        }
          </div>
        `;
      }

      $("#calendar").html(calendarHTML);
      $(".calendar-day:not(.empty)").on("click", function () {
        widget.showDealsForDate($(this).data("date"));
      });

      if (widget.state.selectedDate) {
        widget.showDealsForDate(widget.state.selectedDate);
      }
    };

    // Проверка на сегодняшнюю дату
    this.isToday = function (dateStr) {
      const today = new Date();
      const checkDate = new Date(dateStr);
      return (
        checkDate.getDate() === today.getDate() &&
        checkDate.getMonth() === today.getMonth() &&
        checkDate.getFullYear() === today.getFullYear()
      );
    };

    // Показать сделки для даты
    this.showDealsForDate = function (date) {
      widget.state.selectedDate = date;
      const dateObj = new Date(date);

      $("#selectedDate").text(
        dateObj.toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );

      const deals = widget.state.dealsData[date] || [];

      if (deals.length === 0) {
        $("#deals").html(
          `<div class="no-deals">${widget.i18n.errors.noDeals}</div>`
        );
        return;
      }

      $("#deals").html(
        deals
          .sort((a, b) => b.id - a.id)
          .map(
            (deal) => `
          <div class="deal-item" data-deal-id="${deal.id}">
            <div class="deal-header">
              <span class="deal-id">#${deal.id}</span>
              <span class="deal-status">${widget.getStatusName(
                deal.status_id
              )}</span>
            </div>
            <div class="deal-name">${deal.name}</div>
            <div class="deal-price">${
              deal.price ? `${deal.price} руб.` : "—"
            }</div>
            <div class="deal-field">
              <span>Доставка:</span> ${
                deal.custom_fields[widget.fieldIds.DELIVERY_RANGE] || "—"
              }
            </div>
          </div>
        `
          )
          .join("")
      );

      $(".deal-item").on("click", function (e) {
        e.stopPropagation();
        widget.openDealCard($(this).data("deal-id"));
      });
    };

    // Получение названия статуса
    this.getStatusName = function (statusId) {
      const statuses = {
        142: "Новая",
        143: "В работе",
        144: "Завершена",
        145: "Отменена",
      };
      return statuses[statusId] || `Статус #${statusId}`;
    };

    // Открытие карточки сделки
    this.openDealCard = function (dealId) {
      if (widget.state.system) {
        widget.state.system.openCard(parseInt(dealId));
      } else {
        window.open(
          `https://${widget.state.system.account}.amocrm.ru/leads/detail/${dealId}`,
          "_blank"
        );
      }
    };

    // Переключение месяцев
    this.prevMonth = function () {
      widget.state.currentDate.setMonth(
        widget.state.currentDate.getMonth() - 1
      );
      widget.loadDealsData().then(() => widget.renderCalendar());
    };

    this.nextMonth = function () {
      widget.state.currentDate.setMonth(
        widget.state.currentDate.getMonth() + 1
      );
      widget.loadDealsData().then(() => widget.renderCalendar());
    };

    // Вспомогательные методы
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

    // Callback-функции для amoCRM
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
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            widget.log("No settings provided for onSave");
            return false;
          }
          widget.applySettings(newSettings);
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
    } catch (e) {
      console.error("Widget registration failed:", e);
    }
  }

  return OrdersCalendarWidget;
});

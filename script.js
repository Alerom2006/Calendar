define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const self = this; // Сохраняем контекст виджета

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
        noDeals: "Нет сделок на выбранную дату",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
      },
    };

    // Методы виджета
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined")
          return reject(new Error("AmoCRM API not available"));
        if (typeof AmoCRM.widgets.system !== "function")
          return reject(new Error("Invalid amoCRM API"));

        AmoCRM.widgets
          .system()
          .then((system) => {
            self.state.system = system;
            self.state.initialized = true;
            resolve(true);
          })
          .catch(reject);
      });
    };

    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (self.state.system?.settings) {
          self.applySettings(self.state.system.settings);
        }
        resolve(true);
      });
    };

    this.applySettings = function (settings) {
      if (settings.deal_date_field_id) {
        self.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || self.fieldIds.ORDER_DATE;
      }
      if (settings.delivery_range_field) {
        self.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          self.fieldIds.DELIVERY_RANGE;
      }
    };

    this.getDealIdFromUrl = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    this.setupUI = function () {
      $("#widget-root").html(`
        <div class="widget-container">
          <div id="calendar"></div>
          <div id="deals-container"></div>
        </div>
      `);
      self.loadDealsData();
    };

    this.loadDealsData = function () {
      self.state.isLoading = true;
      self.showLoader();

      const dateFrom = new Date(
        self.state.currentDate.getFullYear(),
        self.state.currentDate.getMonth() - 1,
        1
      );
      const dateTo = new Date(
        self.state.currentDate.getFullYear(),
        self.state.currentDate.getMonth() + 2,
        0
      );

      const filter = {
        [self.fieldIds.ORDER_DATE]: {
          from: Math.floor(dateFrom.getTime() / 1000),
          to: Math.floor(dateTo.getTime() / 1000),
        },
      };

      self.state.system
        .request("/api/v4/leads", { filter })
        .then((response) => {
          self.processDealsData(response._embedded?.leads || []);
          self.renderCalendar();
        })
        .catch((error) => {
          self.showError(self.i18n.errors.load);
        })
        .finally(() => {
          self.state.isLoading = false;
          self.hideLoader();
        });
    };

    this.processDealsData = function (deals) {
      self.state.dealsData = {};
      deals.forEach((deal) => {
        const dateField = deal.custom_fields_values?.find(
          (field) => field.field_id === self.fieldIds.ORDER_DATE
        );
        if (dateField?.values?.[0]?.value) {
          const dateStr = new Date(dateField.values[0].value * 1000)
            .toISOString()
            .split("T")[0];
          if (!self.state.dealsData[dateStr])
            self.state.dealsData[dateStr] = [];
          self.state.dealsData[dateStr].push(deal);
        }
      });
    };

    this.renderCalendar = function () {
      const month = self.state.currentDate.getMonth();
      const year = self.state.currentDate.getFullYear();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

      let calendarHTML = self.i18n.weekdays
        .map((day) => `<div class="weekday">${day}</div>`)
        .join("");

      for (let i = 0; i < startDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
      }

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const dealsCount = self.state.dealsData[dateStr]?.length || 0;
        calendarHTML += `
          <div class="calendar-day ${
            dealsCount ? "has-deals" : ""
          }" data-date="${dateStr}">
            ${day}${
          dealsCount ? `<span class="deal-count">${dealsCount}</span>` : ""
        }
          </div>
        `;
      }

      $("#calendar").html(calendarHTML);
      $(".calendar-day:not(.empty)").on("click", function () {
        self.showDealsForDate($(this).data("date"));
      });
    };

    this.showDealsForDate = function (date) {
      self.state.selectedDate = date;
      const deals = self.state.dealsData[date] || [];

      $("#deals-container").html(`
        <h3>${self.i18n.labels.dealsFor} ${new Date(date).toLocaleDateString(
        "ru-RU"
      )}</h3>
        ${
          deals.length
            ? deals
                .map(
                  (deal) => `
            <div class="deal-item" data-deal-id="${deal.id}">
              <div class="deal-name">${deal.name}</div>
              <div class="deal-price">${deal.price || 0} руб.</div>
            </div>
          `
                )
                .join("")
            : `<div class="no-deals">${self.i18n.errors.noDeals}</div>`
        }
      `);

      $(".deal-item").on("click", function () {
        self.openDealCard($(this).data("deal-id"));
      });
    };

    this.openDealCard = function (dealId) {
      if (self.state.system) {
        self.state.system.openCard(parseInt(dealId));
      } else {
        window.open(
          `https://${self.state.system.account}.amocrm.ru/leads/detail/${dealId}`,
          "_blank"
        );
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

    // Объект callback-функций (должен быть объявлен в конце)
    this.callbacks = {
      init: function () {
        return self
          .initSystem()
          .then(() => self.loadSettings())
          .then(() => {
            self.setupUI();
            return true;
          })
          .catch((err) => {
            console.error("Init error:", err);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) {
            console.error("No settings provided");
            return false;
          }
          self.applySettings(newSettings);
          return true;
        } catch (e) {
          console.error("onSave error:", e);
          return false;
        }
      },

      render: function () {
        try {
          if (!self.state.initialized) return false;
          self.setupUI();
          return true;
        } catch (e) {
          console.error("Render error:", e);
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

    return this; // Важно возвращать this, а не объект
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

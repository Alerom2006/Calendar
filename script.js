define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const self = this;

    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.5",
      debugMode: false,
    };

    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      accessToken: localStorage.getItem("amo_access_token") || null,
    };

    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
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
        auth: "Требуется авторизация",
        noDeals: "Нет сделок на выбранную дату",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться",
        save: "Сохранить",
        today: "Сегодня",
      },
    };

    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          if (!self.state.accessToken) {
            self.showAuthRequired();
          }
          return reject("AmoCRM API not available");
        }

        AmoCRM.widgets
          .system()
          .then((system) => {
            self.state.system = system;
            self.state.initialized = true;
            resolve(true);
          })
          .catch((err) => {
            if (!self.state.accessToken) {
              self.showAuthRequired();
            }
            reject(err);
          });
      });
    };

    this.showAuthRequired = function () {
      $("#widget-root").html(`
                <div class="auth-required">
                    <p>${self.i18n.errors.auth}</p>
                    <button id="authBtn" class="btn">${self.i18n.labels.authButton}</button>
                </div>
            `);
      $("#authBtn").click(() => {
        const domain = self.getAccountDomain();
        window.location.href = `https://${domain}.amocrm.ru/oauth2/authorize`;
      });
    };

    this.getAccountDomain = function () {
      if (self.state.system?.account) return self.state.system.account;
      return window.location.hostname.split(".")[0] || "";
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
      if (settings?.deal_date_field_id) {
        self.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || self.fieldIds.ORDER_DATE;
      }
      if (settings?.delivery_range_field) {
        self.fieldIds.DELIVERY_RANGE =
          parseInt(settings.delivery_range_field) ||
          self.fieldIds.DELIVERY_RANGE;
      }
      self.state.settings = settings || {};
    };

    this.loadDeals = function () {
      if (!self.state.initialized && !self.state.accessToken)
        return Promise.reject("Not initialized");

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

      return new Promise((resolve, reject) => {
        const requestData = {
          filter: {
            [self.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        };

        if (typeof AmoCRM !== "undefined") {
          AmoCRM.request("/api/v4/leads", requestData)
            .then((response) => {
              self.processDealsData(response._embedded?.leads || []);
              resolve(true);
            })
            .catch(reject);
        } else if (self.state.accessToken) {
          $.ajax({
            url: `https://${self.getAccountDomain()}.amocrm.ru/api/v4/leads`,
            headers: { Authorization: `Bearer ${self.state.accessToken}` },
            data: requestData,
            success: (response) => {
              self.processDealsData(response._embedded?.leads || []);
              resolve(true);
            },
            error: reject,
          });
        } else {
          reject("No auth method available");
        }
      });
    };

    this.processDealsData = function (deals) {
      self.state.dealsData = {};
      deals.forEach((deal) => {
        const dateField = deal.custom_fields_values?.find(
          (f) => f.field_id === self.fieldIds.ORDER_DATE
        );
        if (dateField?.values?.[0]?.value) {
          const dateStr = new Date(dateField.values[0].value * 1000)
            .toISOString()
            .split("T")[0];
          if (!self.state.dealsData[dateStr])
            self.state.dealsData[dateStr] = [];

          self.state.dealsData[dateStr].push({
            id: deal.id,
            name: deal.name,
            price: deal.price,
            status_id: deal.status_id,
            custom_fields: {
              [self.fieldIds.DELIVERY_RANGE]: self.getCustomFieldValue(
                deal,
                self.fieldIds.DELIVERY_RANGE
              ),
              [self.fieldIds.ADDRESS]: self.getCustomFieldValue(
                deal,
                self.fieldIds.ADDRESS
              ),
            },
          });
        }
      });
    };

    this.getCustomFieldValue = function (deal, fieldId) {
      const field = deal.custom_fields_values?.find(
        (f) => f.field_id === fieldId
      );
      return field?.values?.[0]?.value || null;
    };

    this.renderCalendar = function () {
      const month = self.state.currentDate.getMonth();
      const year = self.state.currentDate.getFullYear();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

      let html = `
                <div class="calendar-header">
                    <button id="prevMonth" class="btn">←</button>
                    <h2>${self.i18n.months[month]} ${year}</h2>
                    <button id="nextMonth" class="btn">→</button>
                </div>
                <div class="calendar-grid">
            `;

      self.i18n.weekdays.forEach(
        (day) => (html += `<div class="weekday">${day}</div>`)
      );

      for (let i = 0; i < startDay; i++)
        html += '<div class="calendar-day empty"></div>';

      for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const dealsCount = self.state.dealsData[dateStr]?.length || 0;
        const isToday =
          new Date(dateStr).toDateString() === new Date().toDateString();

        html += `
                    <div class="calendar-day ${isToday ? "today" : ""} ${
          dealsCount ? "has-deals" : ""
        }" data-date="${dateStr}">
                        ${day}
                        ${
                          dealsCount
                            ? `<span class="deal-count">${dealsCount}</span>`
                            : ""
                        }
                    </div>
                `;
      }

      html += `</div>`;
      $("#calendarContainer").html(html);

      $(".calendar-day:not(.empty)").click(function () {
        self.showDealsForDate($(this).data("date"));
      });

      $("#prevMonth").click(() => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() - 1);
        self.loadDeals().then(() => self.renderCalendar());
      });

      $("#nextMonth").click(() => {
        self.state.currentDate.setMonth(self.state.currentDate.getMonth() + 1);
        self.loadDeals().then(() => self.renderCalendar());
      });
    };

    this.showDealsForDate = function (date) {
      const deals = self.state.dealsData[date] || [];
      const dateObj = new Date(date);

      let html = `
                <h3>${
                  self.i18n.labels.dealsFor
                } ${dateObj.toLocaleDateString()}</h3>
                <div class="deals-list">
            `;

      if (deals.length === 0) {
        html += `<div class="no-deals">${self.i18n.errors.noDeals}</div>`;
      } else {
        deals.forEach((deal) => {
          html += `
                        <div class="deal-item" data-deal-id="${deal.id}">
                            <div class="deal-header">
                                <span class="deal-id">#${deal.id}</span>
                                <span class="deal-status">${
                                  deal.status_id
                                }</span>
                            </div>
                            <div class="deal-name">${deal.name}</div>
                            <div class="deal-price">${
                              deal.price || 0
                            } руб.</div>
                        </div>
                    `;
        });
      }

      html += `</div>`;
      $("#dealsContainer").html(html);

      $(".deal-item").click(function () {
        self.openDealCard($(this).data("deal-id"));
      });
    };

    this.openDealCard = function (dealId) {
      if (typeof AmoCRM !== "undefined") {
        AmoCRM.widgets.system().then((system) => system.openCard(dealId));
      } else {
        window.open(
          `https://${self.getAccountDomain()}.amocrm.ru/leads/detail/${dealId}`,
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
      $("#error-alert").text(message).show();
      setTimeout(() => $("#error-alert").fadeOut(), 5000);
    };

    this.setupUI = function () {
      $("#widget-root").html(`
                <div id="loader" style="display:none">Загрузка...</div>
                <div id="error-alert" class="alert" style="display:none"></div>
                <div id="calendarContainer"></div>
                <div id="dealsContainer"></div>
            `);

      self
        .loadDeals()
        .then(() => self.renderCalendar())
        .catch((err) => self.showError(err));
    };

    this.callbacks = {
      init: function (system) {
        self.state.system = system;
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

      render: function () {
        try {
          if (!self.state.initialized && !self.state.accessToken) {
            self.showAuthRequired();
            return false;
          }
          self.setupUI();
          return true;
        } catch (e) {
          console.error("Render error:", e);
          return false;
        }
      },

      onSave: function (newSettings) {
        try {
          if (!newSettings) return false;
          self.applySettings(newSettings);
          return true;
        } catch (e) {
          console.error("onSave error:", e);
          return false;
        }
      },

      bind_actions: function () {
        return true;
      },

      destroy: function () {
        $("#widget-root").empty();
        return true;
      },
    };

    return this;
  }

  if (typeof AmoCRM !== "undefined") {
    try {
      if (typeof AmoCRM.Widget !== "undefined") {
        AmoCRM.Widget.register(OrdersCalendarWidget);
      } else if (typeof AmoCRM.Widgets !== "undefined") {
        AmoCRM.Widgets.from("OrdersCalendar", OrdersCalendarWidget);
      }
    } catch (e) {
      console.error("Widget registration failed:", e);
    }
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      new OrdersCalendarWidget();
    });
  }

  return OrdersCalendarWidget;
});

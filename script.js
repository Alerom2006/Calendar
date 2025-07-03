define(["jquery"], function ($) {
  "use strict";

  function OrdersCalendarWidget() {
    this.__amowidget__ = true;
    const self = this;

    // Конфигурация виджета
    this.config = {
      widgetInstanceId:
        "orders-calendar-" + Math.random().toString(36).substr(2, 9),
      version: "1.0.6",
    };

    // Состояние виджета
    this.state = {
      initialized: false,
      system: null,
      settings: {},
      currentDate: new Date(),
      dealsData: {},
      accessToken: localStorage.getItem("amo_access_token") || null,
    };

    // ID кастомных полей (значения по умолчанию)
    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
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
        noDeals: "Нет сделок на выбранную дату",
        auth: "Требуется авторизация",
      },
      labels: {
        dealsFor: "Сделки на",
        today: "Сегодня",
      },
    };

    // Инициализация системы amoCRM
    this.initSystem = function () {
      return new Promise((resolve, reject) => {
        if (typeof AmoCRM === "undefined") {
          return reject("AmoCRM API not available");
        }

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

    // Загрузка настроек
    this.loadSettings = function () {
      return new Promise((resolve) => {
        if (self.state.system?.settings) {
          self.applySettings(self.state.system.settings);
        }
        resolve(true);
      });
    };

    // Применение настроек
    this.applySettings = function (settings) {
      if (settings?.deal_date_field_id) {
        self.fieldIds.ORDER_DATE =
          parseInt(settings.deal_date_field_id) || self.fieldIds.ORDER_DATE;
      }
      self.state.settings = settings || {};
    };

    // Загрузка сделок
    this.loadDeals = function () {
      if (!self.state.initialized) return Promise.reject("Not initialized");

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

        AmoCRM.request("/api/v4/leads", requestData)
          .then((response) => {
            self.processDealsData(response._embedded?.leads || []);
            resolve(true);
          })
          .catch(reject);
      });
    };

    // Обработка данных о сделках
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

          if (!self.state.dealsData[dateStr]) {
            self.state.dealsData[dateStr] = [];
          }

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

    // Получение значения кастомного поля
    this.getCustomFieldValue = function (deal, fieldId) {
      const field = deal.custom_fields_values?.find(
        (f) => f.field_id === fieldId
      );
      return field?.values?.[0]?.value || null;
    };

    // Генерация HTML календаря
    this.generateCalendarHTML = function () {
      const month = self.state.currentDate.getMonth();
      const year = self.state.currentDate.getFullYear();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

      let html = `
        <div class="calendar-header">
          <h3>${self.i18n.months[month]} ${year}</h3>
        </div>
        <div class="calendar-grid">
      `;

      // Дни недели
      self.i18n.weekdays.forEach((day) => {
        html += `<div class="weekday">${day}</div>`;
      });

      // Пустые дни в начале месяца
      for (let i = 0; i < startDay; i++) {
        html += '<div class="calendar-day empty"></div>';
      }

      // Дни месяца
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
        }">
            ${day}
            ${dealsCount ? `<span class="deal-count">${dealsCount}</span>` : ""}
          </div>
        `;
      }

      html += `</div>`;
      return html;
    };

    // Основной метод рендеринга виджета
    this.renderWidget = function () {
      return self
        .loadDeals()
        .then(() => {
          const calendarHTML = self.generateCalendarHTML();

          // Используем render_template для отображения в правой колонке
          self.render_template({
            body: calendarHTML,
            caption: {
              class_name: "orders-calendar-caption",
            },
          });

          return true;
        })
        .catch((err) => {
          console.error("Render error:", err);
          self.render_template({
            body: `<div class="error">${self.i18n.errors.load}</div>`,
          });
          return false;
        });
    };

    // Колбэки виджета
    this.callbacks = {
      init: function (system) {
        self.state.system = system;
        return self
          .initSystem()
          .then(() => self.loadSettings())
          .then(() => true)
          .catch((err) => {
            console.error("Init error:", err);
            return false;
          });
      },

      render: function () {
        return self.renderWidget();
      },

      onSave: function (newSettings) {
        try {
          if (newSettings) {
            self.applySettings(newSettings);
            return true;
          }
          return false;
        } catch (e) {
          console.error("onSave error:", e);
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
      AmoCRM.Widget.register(OrdersCalendarWidget);
    } catch (e) {
      console.error("Widget registration failed:", e);
    }
  }

  return OrdersCalendarWidget;
});

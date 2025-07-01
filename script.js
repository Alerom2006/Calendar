define(["jquery"], function ($) {
  function OrdersCalendar() {
    // Сохраняем контекст
    const self = this;

    // 1. Конфигурация виджета
    this.config = {
      FIELD_IDS: {
        ORDER_DATE: 885453,
        DELIVERY_RANGE: 892009,
        EXACT_TIME: 892003,
        ADDRESS: 887367,
      },
      langs: {
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
        widgetName: "Календарь заказов",
        orderDate: "Дата заказа:",
        openCalendar: "Открыть календарь",
        noDeals: "Нет сделок на эту дату",
        noName: "Без названия",
        delivery: "Доставка",
        time: "Время",
        address: "Адрес",
      },
    };

    // 2. Состояние виджета
    this.state = {
      currentDate: new Date(),
      isLoading: false,
      dealsData: {},
      currentDealId: null,
      accessToken: localStorage.getItem("amo_access_token"),
      settings: {
        deal_date_field_id: "885453",
        delivery_range_field: "892009",
      },
      system: {
        account: "spacebakery1",
        entity_id: null,
      },
    };

    // 3. Основные методы

    // Инициализация системы
    this.initSystem = function () {
      if (
        typeof AmoCRM !== "undefined" &&
        typeof AmoCRM.widgets.system === "function"
      ) {
        return AmoCRM.widgets.system().then(function (systemApi) {
          self.state.system = systemApi;
          self.state.currentDealId = systemApi.entity_id;
          self.state.accessToken =
            systemApi.access_token || self.state.accessToken;
          localStorage.setItem("amo_access_token", self.state.accessToken);
        });
      }
      return Promise.resolve();
    };

    // Загрузка настроек полей
    this.loadFieldIdsFromSettings = function () {
      try {
        if (self.state.settings.deal_date_field_id) {
          self.config.FIELD_IDS.ORDER_DATE =
            parseInt(self.state.settings.deal_date_field_id) ||
            self.config.FIELD_IDS.ORDER_DATE;
        }
        if (self.state.settings.delivery_range_field) {
          self.config.FIELD_IDS.DELIVERY_RANGE =
            parseInt(self.state.settings.delivery_range_field) ||
            self.config.FIELD_IDS.DELIVERY_RANGE;
        }
      } catch (e) {
        console.error("Ошибка загрузки ID полей:", e);
      }
    };

    // Проверка страницы сделки
    this.isDealPage = function () {
      const match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      self.state.currentDealId =
        self.state.system.entity_id || (match ? match[1] : null);
      return !!self.state.currentDealId;
    };

    // 4. Callbacks для amoCRM
    this.callbacks = {
      init: function () {
        return self
          .initSystem()
          .then(function () {
            self.loadFieldIdsFromSettings();
            self.setupUI();
            self.setupEventListeners();
            return true;
          })
          .catch(function (error) {
            console.error("Ошибка инициализации:", error);
            return false;
          });
      },

      onSave: function (newSettings) {
        try {
          console.log("Сохранение настроек:", newSettings);
          if (!newSettings) return false;

          self.state.settings = newSettings;
          self.loadFieldIdsFromSettings();

          if (!self.isDealPage()) {
            self.renderCalendar();
          }

          return true;
        } catch (error) {
          console.error("Ошибка сохранения настроек:", error);
          return false;
        }
      },

      // Обязательные callback-и
      render: function () {
        return true;
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
    };

    // 5. UI методы
    this.setupUI = function () {
      if (self.isDealPage()) {
        $("#widget_container").addClass("deal-widget-mode");
        self.loadDealData();
      } else {
        $("#currentMonthYear").text(
          `${
            self.config.langs.months[self.state.currentDate.getMonth()]
          } ${self.state.currentDate.getFullYear()}`
        );
        self.renderCalendar();
      }
    };

    // 6. API методы
    this.fetchDeals = function (year, month) {
      if (!self.state.accessToken) return Promise.resolve({});

      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      return $.ajax({
        url: `https://${self.state.system.account}.amocrm.ru/api/v4/leads`,
        data: {
          "filter[custom_fields_values][field_id]":
            self.config.FIELD_IDS.ORDER_DATE,
          "filter[custom_fields_values][from]": startDate,
          "filter[custom_fields_values][to]": endDate,
        },
        headers: {
          Authorization: `Bearer ${self.state.accessToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then(self.processDealsData.bind(self))
        .catch(function (error) {
          console.error("Ошибка загрузки сделок:", error);
          return {};
        });
    };

    // 7. Возвращаем публичный интерфейс
    return {
      callbacks: this.callbacks,
      // Другие публичные методы при необходимости
    };
  }

  return OrdersCalendar;
});

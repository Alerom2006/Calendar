define(["jquery"], function ($) {
  var OrdersCalendar = function () {
    var self = this;

    // Константы и настройки
    this.FIELD_IDS = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    this.langs = {
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
    };

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      isLoading: false,
      dealsData: {},
      currentDealId: null,
      accessToken: null,
      settings: {
        deal_date_field_id: "885453",
        delivery_range_field: "892009",
      },
    };

    // Инициализация системы
    this.initSystem = function () {
      this.system = {
        account: "spacebakery1",
        entity_id: null,
      };

      if (
        typeof AmoCRM !== "undefined" &&
        typeof AmoCRM.widgets.system === "function"
      ) {
        AmoCRM.widgets.system().then(function (systemApi) {
          self.system = systemApi;
          self.state.currentDealId = systemApi.entity_id;
          self.state.accessToken =
            systemApi.access_token || localStorage.getItem("amo_access_token");
        });
      }
    };

    // Основные методы
    this.getDealIdFromUrl = function () {
      var match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? match[1] : null;
    };

    this.isDealPage = function () {
      this.state.currentDealId =
        this.system.entity_id || this.getDealIdFromUrl();
      return !!this.state.currentDealId;
    };

    this.loadFieldIdsFromSettings = function () {
      try {
        if (this.state.settings.deal_date_field_id) {
          this.FIELD_IDS.ORDER_DATE =
            parseInt(this.state.settings.deal_date_field_id) ||
            this.FIELD_IDS.ORDER_DATE;
        }
        if (this.state.settings.delivery_range_field) {
          this.FIELD_IDS.DELIVERY_RANGE =
            parseInt(this.state.settings.delivery_range_field) ||
            this.FIELD_IDS.DELIVERY_RANGE;
        }
      } catch (e) {
        console.error("Ошибка загрузки ID полей:", e);
      }
    };

    // UI методы
    this.setupUI = function () {
      if (this.isDealPage()) {
        $("#widget_container").addClass("deal-widget-mode");
        this.loadDealData();
      } else {
        $("#currentMonthYear").text(this.getMonthTitle());
        this.renderCalendar();
      }
    };

    this.getMonthTitle = function () {
      return (
        this.langs.months[this.state.currentDate.getMonth()] +
        " " +
        this.state.currentDate.getFullYear()
      );
    };

    // Работа с API
    this.fetchDeals = function (year, month) {
      if (!this.state.accessToken) return Promise.resolve({});

      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      return $.ajax({
        url: `https://${this.system.account}.amocrm.ru/api/v4/leads`,
        data: {
          "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
          "filter[custom_fields_values][from]": startDate,
          "filter[custom_fields_values][to]": endDate,
        },
        headers: {
          Authorization: `Bearer ${this.state.accessToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 15000,
      })
        .then(this.processDealsData.bind(this))
        .catch(function (error) {
          console.error("Ошибка загрузки сделок:", error);
          return {};
        });
    };

    // Callbacks для amoCRM
    this.callbacks = {
      init: function () {
        try {
          self.initSystem();
          self.loadFieldIdsFromSettings();
          self.setupUI();
          self.setupEventListeners();
          return true;
        } catch (error) {
          console.error("Ошибка инициализации:", error);
          self.showError("Ошибка загрузки виджета");
          return false;
        }
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

      // Остальные обязательные callbacks
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
      advancedSettings: function () {
        return true;
      },
      destroy: function () {
        return true;
      },
      contacts: {
        selected: function () {
          return true;
        },
      },
      leads: {
        selected: function () {
          return true;
        },
      },
      todo: {
        selected: function () {
          return true;
        },
      },
      onAddAsSource: function () {
        return true;
      },
    };

    // Инициализация
    this.initSystem();
    this.loadFieldIdsFromSettings();

    // Экспорт в глобальную область видимости
    if (typeof window !== "undefined") {
      window.OrdersCalendarInstance = this;
    }

    return this;
  };

  return OrdersCalendar;
});

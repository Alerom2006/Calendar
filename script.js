define(["jquery"], function ($) {
  var CustomWidget = function () {
    var self = this;

    // Инициализация системных объектов
    this.system =
      this.system ||
      function () {
        return {
          account: "spacebakery1",
          entity_id: null,
        };
      };

    this.langs = this.langs || {};
    this.settings = this.settings || {};

    var system = self.system();
    var langs = self.langs;
    var currentDate = new Date();
    var widgetInstanceId = "widget-" + Date.now();
    var accessToken = null;
    var isLoading = false;

    // ID полей
    var FIELD_IDS = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    this.callbacks = {
      init: function () {
        try {
          // Загрузка ID полей из настроек
          if (self.settings.deal_date_field_id) {
            FIELD_IDS.ORDER_DATE =
              parseInt(self.settings.deal_date_field_id) ||
              FIELD_IDS.ORDER_DATE;
          }
          if (self.settings.delivery_range_field) {
            FIELD_IDS.DELIVERY_RANGE =
              parseInt(self.settings.delivery_range_field) ||
              FIELD_IDS.DELIVERY_RANGE;
          }

          // Проверка авторизации
          if (typeof AmoCRM !== "undefined") {
            self.checkAuth();
          }

          return true;
        } catch (error) {
          console.error("Init error:", error);
          return false;
        }
      },

      render: function () {
        return true;
      },

      bind_actions: function () {
        return true;
      },

      settings: function () {
        return true;
      },

      // Ключевое исправление для onSave
      onSave: function (settings) {
        try {
          // Сохраняем настройки
          self.settings = settings;

          // Обновляем ID полей
          FIELD_IDS.ORDER_DATE =
            parseInt(settings.deal_date_field_id) || FIELD_IDS.ORDER_DATE;
          FIELD_IDS.DELIVERY_RANGE =
            parseInt(settings.delivery_range_field) || FIELD_IDS.DELIVERY_RANGE;

          return true;
        } catch (error) {
          console.error("Save error:", error);
          return false;
        }
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
      onSalesbotDesignerSave: function () {
        return true;
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

    // Метод проверки авторизации
    this.checkAuth = function () {
      if (typeof AmoCRM.widgets.system === "function") {
        AmoCRM.widgets.system(widgetInstanceId).then(function (systemApi) {
          accessToken = systemApi.access_token;
        });
      }
    };

    return this;
  };
  return CustomWidget;
});

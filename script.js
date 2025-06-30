define(["jquery"], function ($) {
  var OrdersCalendar = function () {
    var self = this;
    var system = self.system();
    var langs = self.langs;
    var currentDate = new Date();
    var widgetInstanceId = "widget-" + Date.now();
    var accessToken = null;
    var isLoading = false;

    // ID полей по умолчанию (берутся из manifest.json)
    var FIELD_IDS = {
      ORDER_DATE:
        self.settings && self.settings.deal_date_field_id
          ? parseInt(self.settings.deal_date_field_id)
          : 885453,
      DELIVERY_RANGE:
        self.settings && self.settings.delivery_range_field
          ? parseInt(self.settings.delivery_range_field)
          : 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    var dealsData = {};
    var currentDealId = null;

    /* ========== ОСНОВНЫЕ CALLBACK-ФУНКЦИИ ========== */

    this.callbacks = {
      // Инициализация виджета
      init: function () {
        try {
          currentDealId = self.getDealIdFromUrl();
          self.initSettings();
          self.setupUI();

          if (self.isDealPage()) {
            self.loadDealData();
          } else {
            self.renderCalendar();
          }

          self.setupEventListeners();
          return true;
        } catch (error) {
          console.error("Ошибка инициализации:", error);
          self.showError(langs.errors.initialization || "Ошибка инициализации");
          return false;
        }
      },

      // Рендеринг виджета
      render: function () {
        return true;
      },

      // Привязка действий
      bind_actions: function () {
        return true;
      },

      // Настройки виджета
      settings: function () {
        console.log("Настройки виджета:", self.settings);
      },

      // Обработчик сохранения настроек
      onSave: function () {
        try {
          self.updateFieldIdsFromSettings();
          self.renderCalendar();
          return true;
        } catch (error) {
          console.error("Ошибка при сохранении настроек:", error);
          return false;
        }
      },

      // Остальные обязательные callback-функции
      dpSettings: function () {},
      advancedSettings: function () {},
      destroy: function () {},
      contacts: { selected: function () {} },
      onSalesbotDesignerSave: function () {},
      leads: { selected: function () {} },
      todo: { selected: function () {} },
      onAddAsSource: function () {},
    };

    /* ========== ОСНОВНЫЕ МЕТОДЫ ========== */

    // Инициализация настроек
    this.initSettings = function () {
      if (!self.settings) {
        console.warn(
          "Настройки не загружены, используются значения по умолчанию"
        );
        return;
      }

      self.updateFieldIdsFromSettings();
    };

    // Обновление ID полей из настроек
    this.updateFieldIdsFromSettings = function () {
      if (self.settings.deal_date_field_id) {
        FIELD_IDS.ORDER_DATE =
          parseInt(self.settings.deal_date_field_id) || FIELD_IDS.ORDER_DATE;
      }

      if (self.settings.delivery_range_field) {
        FIELD_IDS.DELIVERY_RANGE =
          parseInt(self.settings.delivery_range_field) ||
          FIELD_IDS.DELIVERY_RANGE;
      }

      console.log("Обновленные ID полей:", FIELD_IDS);
    };

    // Получение ID сделки
    this.getDealIdFromUrl = function () {
      if (system && system.entity_id) {
        return system.entity_id;
      }
      return null;
    };

    // Проверка страницы сделки
    this.isDealPage = function () {
      return !!currentDealId;
    };

    // Настройка интерфейса
    this.setupUI = function () {
      if (self.isDealPage()) {
        $("#widget_container").addClass("deal-widget-mode");
      } else {
        $("#currentMonthYear").text(self.getCurrentMonthTitle());
        $("#authButton").text(
          langs.widget.auth_button || "Авторизоваться в amoCRM"
        );
      }
    };

    // Название текущего месяца и года
    this.getCurrentMonthTitle = function () {
      var months = langs.months || [
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
      return months[currentDate.getMonth()] + " " + currentDate.getFullYear();
    };

    // Загрузка данных сделки
    this.loadDealData = function () {
      if (!accessToken || !currentDealId) return;

      self.showLoading(true);

      $.ajax({
        url: `https://${system.account}.amocrm.ru/api/v4/leads/${currentDealId}`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        success: function (deal) {
          self.renderDealWidget(deal);
        },
        error: function (error) {
          console.error("Ошибка загрузки сделки:", error);
          self.showError(langs.errors.deal_loading || "Ошибка загрузки сделки");
        },
        complete: function () {
          self.showLoading(false);
        },
      });
    };

    // Отображение виджета сделки
    this.renderDealWidget = function (deal) {
      var container = $("#widget_container");
      if (!container.length) return;

      var dateField = deal.custom_fields_values?.find(
        (f) => f.field_id == FIELD_IDS.ORDER_DATE
      );
      var dateValue =
        dateField?.values?.[0]?.value ||
        langs.widget.date_not_set ||
        "Дата не указана";

      container.html(`
        <div class="deal-widget">
          <h3>${langs.widget.name || "Календарь заказов"}</h3>
          <div class="deal-date">
            <strong>${langs.widget.order_date || "Дата заказа:"}</strong>
            <span>${dateValue}</span>
          </div>
          <button id="openCalendar" class="btn btn-primary mt-2">
            ${langs.widget.open_calendar || "Открыть календарь"}
          </button>
        </div>
      `);
    };

    // Рендер календаря
    this.renderCalendar = function () {
      if (isLoading) return;
      isLoading = true;
      self.showLoading(true);

      var year = currentDate.getFullYear();
      var month = currentDate.getMonth();

      $("#currentMonthYear").text(self.getCurrentMonthTitle());

      self
        .fetchDeals(year, month)
        .then(function (data) {
          dealsData = data;
          self.renderCalendarGrid(year, month);
        })
        .catch(function (error) {
          console.error("Ошибка загрузки данных:", error);
          self.showError(langs.errors.data_loading || "Ошибка загрузки данных");
        })
        .finally(function () {
          isLoading = false;
          self.showLoading(false);
        });
    };

    // Рендер сетки календаря
    this.renderCalendarGrid = function (year, month) {
      var calendarElement = $("#calendar");
      if (!calendarElement.length) return;

      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var weekdays = langs.weekdays || [
        "Пн",
        "Вт",
        "Ср",
        "Чт",
        "Пт",
        "Сб",
        "Вс",
      ];

      var html = '<div class="weekdays">';
      weekdays.forEach((day) => (html += `<div class="weekday">${day}</div>`));
      html += '</div><div class="days">';

      // Пустые ячейки для первого дня недели
      for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        html += '<div class="day empty"></div>';
      }

      // Дни месяца
      for (var day = 1; day <= daysInMonth; day++) {
        var date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        var dealCount = dealsData[date]?.length || 0;
        html += `<div class="day ${
          dealCount ? "has-deals" : ""
        }" data-date="${date}">
          ${day}${
          dealCount ? `<span class="deal-count">${dealCount}</span>` : ""
        }
        </div>`;
      }

      calendarElement.html(html + "</div>");
      $(".day:not(.empty)").on("click", function () {
        self.renderDeals($(this).data("date"));
      });
    };

    // Рендер списка сделок
    this.renderDeals = function (date) {
      var dealsContainer = $("#deals");
      var dateElement = $("#selected-date");
      if (!dealsContainer.length || !dateElement.length) return;

      dateElement.text(
        new Date(date).toLocaleDateString(langs.locale || "ru", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );

      var deals = dealsData[date] || [];
      if (deals.length) {
        var dealsHtml = deals
          .map(
            (deal) => `
          <div class="deal-card">
            <div class="deal-name">${
              deal.name || langs.widget.no_name || "Без названия"
            }</div>
            ${self.renderDealFields(deal)}
          </div>
        `
          )
          .join("");
        dealsContainer.html(dealsHtml);
      } else {
        dealsContainer.html(
          `<div class="no-deals">${
            langs.widget.no_deals || "Нет сделок на эту дату"
          }</div>`
        );
      }
    };

    // Рендер полей сделки
    this.renderDealFields = function (deal) {
      var fields = [
        {
          id: FIELD_IDS.DELIVERY_RANGE,
          name: langs.widget.delivery || "Доставка",
        },
        {
          id: FIELD_IDS.EXACT_TIME,
          name: langs.widget.time || "Время",
        },
        {
          id: FIELD_IDS.ADDRESS,
          name: langs.widget.address || "Адрес",
        },
      ];

      return fields
        .map((field) => {
          var value = deal.custom_fields_values?.find(
            (f) => f.field_id == field.id
          )?.values?.[0]?.value;
          return value
            ? `
          <div class="deal-field">
            <strong>${field.name}:</strong> ${value}
          </div>
        `
            : "";
        })
        .join("");
    };

    // Загрузка сделок
    this.fetchDeals = function (year, month) {
      if (!accessToken) return Promise.resolve({});

      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      return $.ajax({
        url: `https://${system.account}.amocrm.ru/api/v4/leads`,
        data: {
          "filter[custom_fields_values][field_id]": FIELD_IDS.ORDER_DATE,
          "filter[custom_fields_values][from]": startDate,
          "filter[custom_fields_values][to]": endDate,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 15000,
      })
        .then(function (data) {
          return self.processDealsData(data);
        })
        .catch(function (error) {
          console.error("Ошибка при загрузке сделок:", error);
          self.showError(
            langs.errors.deals_loading || "Ошибка при загрузке сделок"
          );
          return {};
        });
    };

    // Обработка данных сделок
    this.processDealsData = function (data) {
      if (!data?._embedded?.leads) return {};

      return data._embedded.leads.reduce(function (acc, deal) {
        var dateField = deal.custom_fields_values?.find(
          (f) => f.field_id == FIELD_IDS.ORDER_DATE
        );
        var date =
          dateField?.values?.[0]?.value?.split(" ")[0] ||
          new Date(deal.created_at * 1000).toISOString().split("T")[0];

        if (!acc[date]) acc[date] = [];
        acc[date].push(deal);
        return acc;
      }, {});
    };

    // Навигация по месяцам
    this.navigateMonth = function (offset) {
      currentDate.setMonth(currentDate.getMonth() + offset);
      self.renderCalendar();
    };

    // Настройка обработчиков событий
    this.setupEventListeners = function () {
      $("#prevMonth").on("click", function () {
        self.navigateMonth(-1);
      });
      $("#nextMonth").on("click", function () {
        self.navigateMonth(1);
      });
      $("#authButton").on("click", self.handleAuth);
      $(document).on("click", "#openCalendar", self.openFullCalendar);
    };

    // Открытие полного календаря
    this.openFullCalendar = function () {
      window.open(
        `https://${system.account}.amocrm.ru/private/widgets/calendar`,
        "_blank"
      );
    };

    // Авторизация
    this.handleAuth = function () {
      window.location.href = `https://${
        system.account
      }.amocrm.ru/oauth2/authorize?${$.param({
        client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
        redirect_uri:
          "https://alerom2006.github.io/Calendar/oauth_callback.html",
        state: widgetInstanceId,
      })}`;
    };

    // Показать/скрыть загрузку
    this.showLoading = function (show) {
      $("#loader").css("display", show ? "block" : "none");
    };

    // Показать ошибку
    this.showError = function (message) {
      var errorElement = $("#error-alert");
      if (errorElement.length) {
        errorElement.text(message).removeClass("d-none");
      }
    };

    return this;
  };

  return OrdersCalendar;
});

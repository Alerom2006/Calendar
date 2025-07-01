define(["jquery"], function ($) {
  var OrdersCalendar = function () {
    var self = this;

    this.system =
      this.system ||
      function () {
        return {
          account: "spacebakery1",
          entity_id: null,
        };
      };

    this.langs = this.langs || {
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

    this.settings = this.settings || {
      deal_date_field_id: "885453",
      delivery_range_field: "892009",
    };

    var system = self.system();
    var langs = self.langs;
    var currentDate = new Date();
    var widgetInstanceId = "widget-" + Date.now();
    var accessToken = localStorage.getItem(
      "amo_access_token_" + widgetInstanceId
    );
    var isLoading = false;

    var FIELD_IDS = {
      ORDER_DATE: parseInt(self.settings.deal_date_field_id) || 885453,
      DELIVERY_RANGE: parseInt(self.settings.delivery_range_field) || 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    var dealsData = {};
    var currentDealId = system.entity_id || null;

    // Методы виджета
    this.loadFieldIdsFromSettings = function () {
      if (self.settings.deal_date_field_id) {
        FIELD_IDS.ORDER_DATE =
          parseInt(self.settings.deal_date_field_id) || FIELD_IDS.ORDER_DATE;
      }
      if (self.settings.delivery_range_field) {
        FIELD_IDS.DELIVERY_RANGE =
          parseInt(self.settings.delivery_range_field) ||
          FIELD_IDS.DELIVERY_RANGE;
      }
    };

    this.getDealIdFromUrl = function () {
      var match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? match[1] : null;
    };

    this.isDealPage = function () {
      currentDealId = system.entity_id || self.getDealIdFromUrl();
      return !!currentDealId;
    };

    this.checkAuth = function () {
      if (typeof AmoCRM.widgets.system === "function") {
        AmoCRM.widgets.system(widgetInstanceId).then(function (systemApi) {
          accessToken = systemApi.access_token;
          localStorage.setItem(
            "amo_access_token_" + widgetInstanceId,
            accessToken
          );
        });
      }
    };

    this.setupUI = function () {
      if (self.isDealPage()) {
        $("#widget_container").addClass("deal-widget-mode");
      } else {
        $("#currentMonthYear").text(self.getMonthTitle());
        $("#authButton").text("Авторизоваться");
      }
    };

    this.getMonthTitle = function () {
      return (
        langs.months[currentDate.getMonth()] + " " + currentDate.getFullYear()
      );
    };

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
          console.error("Error loading deal:", error);
          self.showError("Ошибка загрузки сделки");
        },
        complete: function () {
          self.showLoading(false);
        },
      });
    };

    this.renderDealWidget = function (deal) {
      var container = $("#widget_container");
      if (!container.length) return;

      var dateField = deal.custom_fields_values?.find(
        (f) => f.field_id == FIELD_IDS.ORDER_DATE
      );
      var dateValue = dateField?.values?.[0]?.value || "Дата не указана";

      container.html(`
        <div class="deal-widget">
          <h3>${langs.widgetName}</h3>
          <div class="deal-date">
            <strong>${langs.orderDate}</strong>
            <span>${dateValue}</span>
          </div>
          <button id="openCalendar" class="btn btn-primary mt-2">
            ${langs.openCalendar}
          </button>
        </div>
      `);
    };

    this.renderCalendar = function () {
      if (isLoading) return;
      isLoading = true;
      self.showLoading(true);

      var year = currentDate.getFullYear();
      var month = currentDate.getMonth();

      $("#currentMonthYear").text(self.getMonthTitle());

      self
        .fetchDeals(year, month)
        .then(function (data) {
          dealsData = data;
          self.renderCalendarGrid(year, month);
        })
        .catch(function (error) {
          console.error("Error loading deals:", error);
          self.showError("Ошибка загрузки данных");
        })
        .finally(function () {
          isLoading = false;
          self.showLoading(false);
        });
    };

    this.renderCalendarGrid = function (year, month) {
      var calendarElement = $("#calendar");
      if (!calendarElement.length) return;

      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();

      var html = '<div class="weekdays">';
      langs.weekdays.forEach(function (day) {
        html += `<div class="weekday">${day}</div>`;
      });
      html += '</div><div class="days">';

      for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        html += '<div class="day empty"></div>';
      }

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
      $(".day:not(.empty)")
        .off("click")
        .on("click", function () {
          self.renderDeals($(this).data("date"));
        });
    };

    this.renderDeals = function (date) {
      var dealsContainer = $("#deals");
      var dateElement = $("#selected-date");
      if (!dealsContainer.length || !dateElement.length) return;

      dateElement.text(
        new Date(date).toLocaleDateString("ru", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );

      var deals = dealsData[date] || [];
      dealsContainer.html(
        deals.length
          ? deals.map((deal) => self.renderDealCard(deal)).join("")
          : `<div class="no-deals">${langs.noDeals}</div>`
      );
    };

    this.renderDealCard = function (deal) {
      return `
        <div class="deal-card">
          <div class="deal-name">${deal.name || langs.noName}</div>
          ${self.renderDealFields(deal)}
        </div>
      `;
    };

    this.renderDealFields = function (deal) {
      var fields = [
        { id: FIELD_IDS.DELIVERY_RANGE, name: langs.delivery },
        { id: FIELD_IDS.EXACT_TIME, name: langs.time },
        { id: FIELD_IDS.ADDRESS, name: langs.address },
      ];

      return fields
        .map(function (field) {
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
          console.error("Error loading deals:", error);
          return {};
        });
    };

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

    this.navigateMonth = function (offset) {
      currentDate.setMonth(currentDate.getMonth() + offset);
      self.renderCalendar();
    };

    this.setupEventListeners = function () {
      $("#prevMonth")
        .off("click")
        .on("click", function () {
          self.navigateMonth(-1);
        });
      $("#nextMonth")
        .off("click")
        .on("click", function () {
          self.navigateMonth(1);
        });
      $("#authButton").off("click").on("click", self.handleAuth);
      $(document)
        .off("click", "#openCalendar")
        .on("click", "#openCalendar", self.openFullCalendar);
    };

    this.openFullCalendar = function () {
      window.open(
        `https://${system.account}.amocrm.ru/private/widgets/calendar`,
        "_blank"
      );
    };

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

    this.showLoading = function (show) {
      $("#loader").toggle(show);
    };

    this.showError = function (message) {
      var errorElement = $("#error-alert");
      if (errorElement.length) {
        errorElement.text(message).removeClass("d-none");
        setTimeout(function () {
          errorElement.addClass("d-none");
        }, 5000);
      }
    };

    // Перенесенный объект callbacks
    this.callbacks = {
      init: function () {
        try {
          self.loadFieldIdsFromSettings();

          if (typeof AmoCRM !== "undefined") {
            self.checkAuth();
          }

          self.setupUI();

          if (self.isDealPage()) {
            self.loadDealData();
          } else {
            self.renderCalendar();
          }

          self.setupEventListeners();
          return true;
        } catch (error) {
          console.error("Initialization error:", error);
          self.showError("Ошибка инициализации");
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

      onSave: function (newSettings) {
        try {
          if (!newSettings) return false;

          self.settings = newSettings;
          FIELD_IDS.ORDER_DATE =
            parseInt(newSettings.deal_date_field_id) || FIELD_IDS.ORDER_DATE;
          FIELD_IDS.DELIVERY_RANGE =
            parseInt(newSettings.delivery_range_field) ||
            FIELD_IDS.DELIVERY_RANGE;

          if (!self.isDealPage()) {
            self.renderCalendar();
          }

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

    return this;
  };
  return OrdersCalendar;
});

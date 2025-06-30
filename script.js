define(["jquery"], function ($) {
  var OrdersCalendar = function () {
    var self = this;
    var system = self.system();
    var langs = self.langs;

    // Фиксированные конфигурации (игнорируем настройки из manifest)
    this.widgetInstanceId = "widget-" + Date.now();
    this.currentDate = new Date();
    this.lang = system.lang || "ru";
    this.accessToken = system.access_token || null;
    this.isLoading = false;
    this.FIELD_IDS = {
      ORDER_DATE: 885453, // Фиксированное значение
      DELIVERY_RANGE: 892009, // Фиксированное значение
      EXACT_TIME: 892003, // Фиксированное значение
      ADDRESS: 887367, // Фиксированное значение
    };
    this.dealsData = {};
    this.currentDealId = null;

    // Основные callback-функции
    this.callbacks = {
      init: function () {
        try {
          self.currentDealId = self.getDealIdFromUrl();
          self.setupUI();

          if (self.isDealPage()) {
            self.loadDealData();
          } else {
            self.renderCalendar();
          }
          return true;
        } catch (error) {
          console.error("Ошибка инициализации:", error);
          self.showError(
            langs.errors?.initialization || "Ошибка инициализации"
          );
          return false;
        }
      },

      render: function () {
        return true;
      },

      bind_actions: function () {
        $(document).on("click", "#prevMonth", function () {
          self.navigateMonth(-1);
        });

        $(document).on("click", "#nextMonth", function () {
          self.navigateMonth(1);
        });

        $(document).on("click", "#authButton", function () {
          self.handleAuth();
        });

        $(document).on("click", "#openCalendar", function () {
          self.openFullCalendar();
        });

        $(document).on("click", ".day:not(.empty)", function () {
          self.renderDeals($(this).data("date"));
        });
        return true;
      },

      settings: function (settings) {
        // Обязательная заглушка для настроек
        settings.onSave(function () {
          return true; // Всегда подтверждаем сохранение
        });
        return true;
      },

      onSave: function () {
        return true;
      },

      dpSettings: function () {
        return true;
      },

      destroy: function () {
        $(document).off("click", "#prevMonth");
        $(document).off("click", "#nextMonth");
        $(document).off("click", "#authButton");
        $(document).off("click", "#openCalendar");
        $(document).off("click", ".day:not(.empty)");
        return true;
      },
    };

    // ========== Основные методы виджета ========== //

    this.getDealIdFromUrl = function () {
      if (system.entity_id) return system.entity_id;
      var match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? match[1] : null;
    };

    this.isDealPage = function () {
      return !!this.currentDealId;
    };

    this.setupUI = function () {
      if (this.isDealPage()) {
        $("#widget_container").addClass("deal-widget-mode");
      } else {
        $("#currentMonthYear").text(this.getCurrentMonthTitle());
        $("#authButton").text(
          langs.widget?.auth_button_text || "Авторизоваться в amoCRM"
        );
      }
    };

    this.getCurrentMonthTitle = function () {
      var months =
        this.lang === "ru"
          ? [
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
            ]
          : [
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ];
      return (
        months[this.currentDate.getMonth()] +
        " " +
        this.currentDate.getFullYear()
      );
    };

    this.showLoading = function (show) {
      $("#loader").css("display", show ? "block" : "none");
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

    this.renderCalendar = function () {
      if (this.isLoading) return;
      this.isLoading = true;
      this.showLoading(true);

      var year = this.currentDate.getFullYear();
      var month = this.currentDate.getMonth();

      $("#currentMonthYear").text(this.getCurrentMonthTitle());

      var self = this;
      this.fetchDeals(year, month)
        .then(function (dealsData) {
          self.dealsData = dealsData;
          self.renderCalendarGrid(year, month);
        })
        .catch(function (error) {
          console.error("Ошибка загрузки данных:", error);
          self.showError(
            langs.errors?.data_loading || "Ошибка загрузки данных"
          );
        })
        .finally(function () {
          self.isLoading = false;
          self.showLoading(false);
        });
    };

    this.renderCalendarGrid = function (year, month) {
      var calendarElement = $("#calendar");
      if (!calendarElement.length) return;

      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var weekdays =
        this.lang === "ru"
          ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
          : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      var html = '<div class="weekdays">';
      weekdays.forEach(function (day) {
        html += '<div class="weekday">' + day + "</div>";
      });
      html += '</div><div class="days">';

      for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
        html += '<div class="day empty"></div>';
      }

      for (var day = 1; day <= daysInMonth; day++) {
        var date =
          year +
          "-" +
          String(month + 1).padStart(2, "0") +
          "-" +
          String(day).padStart(2, "0");
        var dealCount = self.dealsData[date]?.length || 0;
        html +=
          '<div class="day ' +
          (dealCount ? "has-deals" : "") +
          '" data-date="' +
          date +
          '">' +
          day +
          (dealCount
            ? '<span class="deal-count">' + dealCount + "</span>"
            : "") +
          "</div>";
      }

      calendarElement.html(html + "</div>");
    };

    this.renderDeals = function (date) {
      var dealsContainer = $("#deals");
      var dateElement = $("#selected-date");
      if (!dealsContainer.length || !dateElement.length) return;

      dateElement.text(
        new Date(date).toLocaleDateString(this.lang, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );

      var deals = this.dealsData[date] || [];
      if (deals.length) {
        var html = deals
          .map(function (deal) {
            return (
              '<div class="deal-card">' +
              '<div class="deal-name">' +
              (deal.name || langs.widget?.no_name || "Без названия") +
              "</div>" +
              self.renderDealFields(deal) +
              "</div>"
            );
          })
          .join("");
        dealsContainer.html(html);
      } else {
        dealsContainer.html(
          '<div class="no-deals">' +
            (langs.widget?.no_deals || "Нет сделок на эту дату") +
            "</div>"
        );
      }
    };

    this.renderDealFields = function (deal) {
      var fields = [
        {
          id: this.FIELD_IDS.DELIVERY_RANGE,
          name: langs.widget?.delivery || "Доставка",
        },
        { id: this.FIELD_IDS.EXACT_TIME, name: langs.widget?.time || "Время" },
        { id: this.FIELD_IDS.ADDRESS, name: langs.widget?.address || "Адрес" },
      ];

      return fields
        .map(function (field) {
          var value = deal.custom_fields_values?.find(function (f) {
            return f.field_id == field.id;
          })?.values?.[0]?.value;

          return value
            ? '<div class="deal-field"><strong>' +
                field.name +
                ":</strong> " +
                value +
                "</div>"
            : "";
        })
        .join("");
    };

    this.fetchDeals = function (year, month) {
      if (!this.accessToken) return Promise.resolve({});

      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      return $.ajax({
        url:
          "https://" +
          system.account +
          ".amocrm.ru/api/v4/leads?" +
          $.param({
            "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
            "filter[custom_fields_values][from]": startDate,
            "filter[custom_fields_values][to]": endDate,
          }),
        headers: {
          Authorization: "Bearer " + this.accessToken,
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 15000,
      })
        .then(function (data) {
          return self.processDealsData(data);
        })
        .fail(function (error) {
          console.error("Ошибка при загрузке сделок:", error);
          self.showError(
            langs.errors?.deals_loading || "Ошибка при загрузке сделок"
          );
          return {};
        });
    };

    this.processDealsData = function (data) {
      if (!data?._embedded?.leads) return {};

      return data._embedded.leads.reduce(function (acc, deal) {
        var dateField = deal.custom_fields_values?.find(function (f) {
          return f.field_id == self.FIELD_IDS.ORDER_DATE;
        });

        var date =
          dateField?.values?.[0]?.value?.split(" ")[0] ||
          new Date(deal.created_at * 1000).toISOString().split("T")[0];

        if (!acc[date]) acc[date] = [];
        acc[date].push(deal);
        return acc;
      }, {});
    };

    this.navigateMonth = function (offset) {
      this.currentDate.setMonth(this.currentDate.getMonth() + offset);
      this.renderCalendar();
    };

    this.loadDealData = function () {
      if (!this.accessToken || !this.currentDealId) return;

      this.showLoading(true);

      var self = this;
      $.ajax({
        url:
          "https://" +
          system.account +
          ".amocrm.ru/api/v4/leads/" +
          this.currentDealId,
        headers: {
          Authorization: "Bearer " + this.accessToken,
          "X-Requested-With": "XMLHttpRequest",
        },
      })
        .then(function (deal) {
          self.renderDealWidget(deal);
        })
        .fail(function (error) {
          console.error("Ошибка загрузки сделки:", error);
          self.showError(
            langs.errors?.deal_loading || "Ошибка загрузки сделки"
          );
        })
        .always(function () {
          self.showLoading(false);
        });
    };

    this.renderDealWidget = function (deal) {
      var container = $("#widget_container");
      if (!container.length) return;

      var dateField = deal.custom_fields_values?.find(function (f) {
        return f.field_id == self.FIELD_IDS.ORDER_DATE;
      });

      var dateValue =
        dateField?.values?.[0]?.value ||
        langs.widget?.date_not_set ||
        "Дата не указана";

      container.html(
        '<div class="deal-widget">' +
          "<h3>" +
          (langs.widget?.orders_calendar || "Календарь заказов") +
          "</h3>" +
          '<div class="deal-date">' +
          "<strong>" +
          (langs.widget?.order_date || "Дата заказа:") +
          "</strong>" +
          "<span>" +
          dateValue +
          "</span>" +
          "</div>" +
          '<button id="openCalendar" class="btn btn-primary mt-2">' +
          (langs.widget?.open_calendar || "Открыть календарь") +
          "</button>" +
          "</div>"
      );
    };

    this.handleAuth = function () {
      window.location.href =
        "https://" +
        system.account +
        ".amocrm.ru/oauth2/authorize?" +
        $.param({
          client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
          redirect_uri:
            "https://alerom2006.github.io/Calendar/oauth_callback.html",
          state: this.widgetInstanceId,
        });
    };

    this.openFullCalendar = function () {
      window.open(
        "https://" + system.account + ".amocrm.ru/private/widgets/calendar",
        "_blank"
      );
    };

    return this;
  };

  return OrdersCalendar;
});

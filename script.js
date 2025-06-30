define(["jquery"], function ($) {
  var OrdersCalendar = function () {
    var self = this;

    // 1. Инициализация системных объектов с защитой от undefined
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

    // 2. ID полей с учетом настроек из manifest.json
    var FIELD_IDS = {
      ORDER_DATE: 885453, // Значение по умолчанию
      DELIVERY_RANGE: 892009, // Значение по умолчанию
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    var dealsData = {};
    var currentDealId = system.entity_id || self.getDealIdFromUrl();

    // 3. ОСНОВНЫЕ CALLBACK-ФУНКЦИИ

    this.callbacks = {
      // Инициализация виджета
      init: function () {
        try {
          console.log("Widget initialization started");

          // Загрузка ID полей из настроек
          self.loadFieldIdsFromSettings();

          // Проверка авторизации
          if (typeof AmoCRM !== "undefined") {
            self.checkAuth();
          }

          // Настройка интерфейса
          self.setupUI();

          // Загрузка данных в зависимости от контекста
          if (self.isDealPage()) {
            self.loadDealData();
          } else {
            self.renderCalendar();
          }

          return true;
        } catch (error) {
          console.error("Initialization error:", error);
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
        console.log("Widget settings opened");
        return true;
      },

      // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: обработчик сохранения настроек
      onSave: function (newSettings) {
        try {
          console.log("Saving settings:", newSettings);

          // Сохраняем новые настройки
          self.settings = newSettings;

          // Обновляем ID полей
          FIELD_IDS.ORDER_DATE =
            parseInt(newSettings.deal_date_field_id) || FIELD_IDS.ORDER_DATE;
          FIELD_IDS.DELIVERY_RANGE =
            parseInt(newSettings.delivery_range_field) ||
            FIELD_IDS.DELIVERY_RANGE;

          console.log("Updated field IDs:", FIELD_IDS);

          // Перерисовываем виджет
          if (!self.isDealPage()) {
            self.renderCalendar();
          }

          return true; // Важно: возвращаем true при успешном сохранении
        } catch (error) {
          console.error("Error saving settings:", error);
          return false; // Возвращаем false при ошибке
        }
      },

      // Остальные обязательные callback-функции
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

    // 4. ОСНОВНЫЕ МЕТОДЫ ВИДЖЕТА

    // Загрузка ID полей из настроек
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
      console.log("Loaded field IDs:", FIELD_IDS);
    };

    // Получение ID сделки из URL
    this.getDealIdFromUrl = function () {
      var match = window.location.pathname.match(/leads\/detail\/(\d+)/);
      return match ? match[1] : null;
    };

    // Проверка, находимся ли на странице сделки
    this.isDealPage = function () {
      return !!currentDealId;
    };

    // Проверка авторизации
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

    // Настройка интерфейса
    this.setupUI = function () {
      if (self.isDealPage()) {
        $("#widget_container").addClass("deal-widget-mode");
      } else {
        $("#currentMonthYear").text(self.getMonthTitle());
        $("#authButton").text(langs.authButton || "Авторизоваться");
      }
    };

    // Форматирование заголовка месяца
    this.getMonthTitle = function () {
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
          console.error("Error loading deal:", error);
          self.showError("Ошибка загрузки сделки");
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
      var dateValue = dateField?.values?.[0]?.value || "Дата не указана";

      container.html(`
        <div class="deal-widget">
          <h3>Календарь заказов</h3>
          <div class="deal-date">
            <strong>Дата заказа:</strong>
            <span>${dateValue}</span>
          </div>
          <button id="openCalendar" class="btn btn-primary mt-2">
            Открыть календарь
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

      // Пустые ячейки
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
      $(".day:not(.empty)")
        .off("click")
        .on("click", function () {
          self.renderDeals($(this).data("date"));
        });
    };

    // Рендер списка сделок
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
          : `<div class="no-deals">Нет сделок на эту дату</div>`
      );
    };

    // Рендер карточки сделки
    this.renderDealCard = function (deal) {
      return `
        <div class="deal-card">
          <div class="deal-name">${deal.name || "Без названия"}</div>
          ${self.renderDealFields(deal)}
        </div>
      `;
    };

    // Рендер полей сделки
    this.renderDealFields = function (deal) {
      var fields = [
        { id: FIELD_IDS.DELIVERY_RANGE, name: "Доставка" },
        { id: FIELD_IDS.EXACT_TIME, name: "Время" },
        { id: FIELD_IDS.ADDRESS, name: "Адрес" },
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

    // Загрузка сделок за период
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

    // Открытие полного календаря
    this.openFullCalendar = function () {
      window.open(
        `https://${system.account}.amocrm.ru/private/widgets/calendar`,
        "_blank"
      );
    };

    // Обработка авторизации
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

    // Управление индикатором загрузки
    this.showLoading = function (show) {
      $("#loader").toggle(show);
    };

    // Отображение ошибок
    this.showError = function (message) {
      var errorElement = $("#error-alert");
      if (errorElement.length) {
        errorElement.text(message).removeClass("d-none");
        setTimeout(function () {
          errorElement.addClass("d-none");
        }, 5000);
      }
    };

    return this;
  };

  return OrdersCalendar;
});

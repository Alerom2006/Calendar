class OrdersCalendar {
  constructor() {
    // Константы класса
    this.FIELD_IDS = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    this.API_URL = "https://spacebakery1.amocrm.ru/api/v4/";
    
    // Долгосрочный токен
    this.LONG_TERM_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjQ0ZjEyMjI0NTVmZWQzYzI1ZTY3MDMyODRiYmI1ZGM1OTQ2ZGY3NjQ0ZmIxMzgxYTY3NzJjYzM1NGMyMjVhOGY3NTE2MDUyYzg0NWIyYWYxIn0.eyJhdWQiOiI5MmFjYzllZS03ODFkLTQ5YzUtYTQzZC05Y2IwZTdmN2E1MjciLCJqdGkiOiI0NGYxMjIyNDU1ZmVkM2MyNWU2NzAzMjg0YmJiNWRjNTk0NmRmNzY0NGZiMTM4MWE2NzcyY2MzNTRjMjI1YThmNzUxNjA1MmM4NDViMmFmMSIsImlhdCI6MTc1MDg1MjE1MCwibmJmIjoxNzUwODUyMTUwLCJleHAiOjE5MDg1NzYwMDAsInN1YiI6IjEwNDgwMDQ2IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxNDcyMTEwLCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiYmIxNzdiZjMtZjlkNC00ZDhkLTg2NTItN2UwNWQ1N2I5M2E1IiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.cQH4gp1Oi2G1XcmEACpUZTqPGfW6P78DWN62CbOcRBXPNAAnDuCIfCruFtGFgoUJFqWj3m_RZKowEuKId0lr9xDkp-25p9rPlFK-bcJ2nhT8CYPx4tUBHhVqbMZjtcqFucC3JBWSvqVu-NYdw0ogv2qxQUXhsovNQaBHH-qADDJgiIyaC_YoiXfsTS637zYJGuqWIjKsq8KzDzNTegGhBuV4iWz2FmW0qYkkEOrIA31lorYKp9SNMF4VoXAc06uoCXyY7--YeifUvc_FrD4X9bwshrxz9lHn32_LhdEMO6owVfuG0GOLhbWnRflIYiqwBBIdXXq8xozl_SWfaja8Ag";

    // Состояние виджета
    this.widgetInstanceId = Date.now();
    this.accessToken = this.LONG_TERM_TOKEN;
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.i18n = this.loadTranslations();
    this.isRefreshingToken = false;

    // Инициализация
    this.init();
  }

  async init() {
    try {
      if (!window.AmoCRM) {
        throw new Error("AmoCRM API не загружен");
      }

      await this.checkAuth();
      this.setupUI();
      await this.renderCalendar();
      this.setupEventListeners();
      this.toggleAuthSection();
    } catch (error) {
      this.showError("Ошибка инициализации: " + error.message);
      console.error(error);
    }
  }

  detectLanguage() {
    try {
      return (window.AmoCRM && window.AmoCRM.constant("lang") || "ru").startsWith("ru") ? "ru" : "en";
    } catch (e) {
      console.error("Ошибка определения языка:", e);
      return "ru";
    }
  }

  loadTranslations() {
    var fallbackTranslations = {
      ru: {
        widget: {
          name: "Календарь заказов",
          description: "Виджет для отображения сделок по датам заказа"
        },
        title: "Календарь заказов",
        prev: "Предыдущий",
        next: "Следующий",
        dealsTitle: "Сделки на {date}",
        noDeals: "На эту дату сделок нет",
        auth: "Авторизоваться",
        fields: {
          delivery: "Доставка",
          exactTime: "Точное время",
          address: "Адрес"
        },
        months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
        weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        errors: {
          fetch_deals: "Ошибка при получении сделок",
          connection: "Ошибка соединения",
          auth: "Ошибка авторизации"
        }
      },
      en: {
        widget: {
          name: "Orders Calendar",
          description: "Widget for displaying deals by order date"
        },
        title: "Orders Calendar",
        prev: "Previous",
        next: "Next",
        dealsTitle: "Deals for {date}",
        noDeals: "No deals this date",
        auth: "Authorize",
        fields: {
          delivery: "Delivery",
          exactTime: "Exact time",
          address: "Address"
        },
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        errors: {
          fetch_deals: "Error fetching deals",
          connection: "Connection error",
          auth: "Authorization error"
        }
      }
    };

    try {
      var amoTranslations = (window.AmoCRM && window.AmoCRM.widgets && window.AmoCRM.widgets.i18n && window.AmoCRM.widgets.i18n.getTranslations()) || {};
      return Object.assign({}, fallbackTranslations[this.lang], amoTranslations);
    } catch (e) {
      console.error("Ошибка загрузки переводов:", e);
      return fallbackTranslations[this.lang];
    }
  }

  async checkAuth() {
    this.accessToken = await this.getAccessToken();
    if (!this.accessToken) {
      console.warn("Токен доступа не получен");
      this.showError(this.i18n.errors && this.i18n.errors.auth || "Ошибка авторизации");
    }
  }

  async getAccessToken(forceRefresh) {
    if (this.isRefreshingToken) {
      return this.accessToken;
    }

    try {
      if (forceRefresh || !this.LONG_TERM_TOKEN) {
        this.isRefreshingToken = true;
        var freshToken = null;
        if (window.AmoCRM && window.AmoCRM.widgets && window.AmoCRM.widgets.system) {
          freshToken = await window.AmoCRM.widgets.system(this.widgetInstanceId).then(function(s) { 
            return s && s.access_token; 
          }).catch(function() { 
            return null; 
          });
        }

        if (freshToken) {
          this.accessToken = freshToken;
          this.storeToken(freshToken);
          return freshToken;
        }
      }

      var storedToken = this.retrieveStoredToken();
      if (storedToken) {
        this.accessToken = storedToken;
        return storedToken;
      }

      return this.LONG_TERM_TOKEN;
    } catch (error) {
      console.error("Ошибка получения токена:", error);
      return this.LONG_TERM_TOKEN;
    } finally {
      this.isRefreshingToken = false;
    }
  }

  storeToken(token) {
    try {
      localStorage.setItem("amo_token_" + this.widgetInstanceId, token);
    } catch (e) {
      console.warn("Не удалось сохранить токен в localStorage:", e);
    }
  }

  retrieveStoredToken() {
    try {
      return localStorage.getItem("amo_token_" + this.widgetInstanceId);
    } catch (e) {
      console.warn("Не удалось получить токен из localStorage:", e);
      return null;
    }
  }

  setupUI() {
    var element = document.getElementById("currentMonthYear");
    if (element) {
      element.textContent = this.getCurrentMonthTitle();
    }
  }

  getCurrentMonthTitle() {
    return this.i18n.months[this.currentDate.getMonth()] + " " + this.currentDate.getFullYear();
  }

  async renderCalendar() {
    try {
      var year = this.currentDate.getFullYear();
      var month = this.currentDate.getMonth();

      var monthYearElement = document.getElementById("currentMonthYear");
      if (monthYearElement) {
        monthYearElement.textContent = this.getCurrentMonthTitle();
      }

      var deals = await this.fetchDeals(year, month);
      this.renderCalendarGrid(year, month, deals);
    } catch (error) {
      this.showError("Ошибка отображения календаря: " + error.message);
    }
  }

  renderCalendarGrid(year, month, deals) {
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    var html = '<div class="weekdays">';
    for (var i = 0; i < this.i18n.weekdays.length; i++) {
      html += '<div class="weekday">' + this.i18n.weekdays[i] + '</div>';
    }

    html += '</div><div class="days">';

    for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      var dealCount = (deals[date] && deals[date].length) || 0;

      html += '<div class="day ' + (dealCount ? "has-deals" : "") + '" data-date="' + date + '">' +
        day +
        (dealCount ? '<span class="deal-count">' + dealCount + '</span>' : "") +
        '</div>';
    }

    var calendarElement = document.getElementById("calendar");
    if (calendarElement) {
      calendarElement.innerHTML = html + "</div>";

      var days = calendarElement.querySelectorAll(".day:not(.empty)");
      for (var i = 0; i < days.length; i++) {
        days[i].addEventListener("click", (function(date, deals) {
          return function() {
            this.renderDeals(date, deals);
          }.bind(this);
        }).bind(this)(days[i].dataset.date, deals));
      }
    }
  }

  renderDeals(date, deals) {
    var dealList = deals[date] || [];
    var dealsContainer = document.getElementById("deals");
    var dateElement = document.getElementById("selected-date");

    if (dateElement) {
      dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    if (!dealsContainer) return;

    if (dealList.length === 0) {
      dealsContainer.innerHTML = '<div class="no-deals">' + this.i18n.noDeals + '</div>';
      return;
    }

    var dealsHtml = "";
    for (var i = 0; i < dealList.length; i++) {
      var deal = dealList[i];
      dealsHtml += '<div class="deal-card" onclick="window.AmoCRM && window.AmoCRM.openCard && window.AmoCRM.openCard(\'lead\', ' + deal.id + ')">' +
        '<div class="deal-name">' + deal.name + '</div>' +
        this.renderDealFields(deal) +
        '</div>';
    }

    dealsContainer.innerHTML = dealsHtml;
  }

  renderDealFields(deal) {
    var fields = [
      { id: this.FIELD_IDS.DELIVERY_RANGE, name: this.i18n.fields.delivery },
      { id: this.FIELD_IDS.EXACT_TIME, name: this.i18n.fields.exactTime },
      { id: this.FIELD_IDS.ADDRESS, name: this.i18n.fields.address }
    ];

    var html = "";
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      var fieldValue = null;
      if (deal.custom_fields_values) {
        for (var j = 0; j < deal.custom_fields_values.length; j++) {
          if (deal.custom_fields_values[j].field_id == field.id) {
            fieldValue = deal.custom_fields_values[j].values && deal.custom_fields_values[j].values[0] && deal.custom_fields_values[j].values[0].value;
            break;
          }
        }
      }
      if (fieldValue) {
        html += '<div class="deal-field"><strong>' + field.name + ':</strong> ' + fieldValue + '</div>';
      }
    }
    return html;
  }

  async fetchDeals(year, month) {
    try {
      this.accessToken = await this.getAccessToken();
      
      if (!this.accessToken) {
        this.showError(this.i18n.errors && this.i18n.errors.auth || "Ошибка авторизации");
        return {};
      }

      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      var params = new URLSearchParams();
      params.append("filter[custom_fields_values][field_id]", this.FIELD_IDS.ORDER_DATE);
      params.append("filter[custom_fields_values][from]", startDate);
      params.append("filter[custom_fields_values][to]", endDate);

      var response = await fetch(this.API_URL + "leads?" + params.toString(), {
        headers: { 
          Authorization: "Bearer " + this.accessToken,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json"
        }
      });

      if (response.status === 401) {
        this.accessToken = await this.getAccessToken(true);
        return this.fetchDeals(year, month);
      }

      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }

      return this.processDealsData(await response.json());
    } catch (error) {
      this.showError(this.i18n.errors && this.i18n.errors.fetch_deals || "Ошибка при получении сделок");
      console.error("Ошибка получения сделок:", error);
      return {};
    }
  }

  processDealsData(data) {
    if (!data._embedded || !data._embedded.leads) return {};

    var result = {};
    for (var i = 0; i < data._embedded.leads.length; i++) {
      var deal = data._embedded.leads[i];
      var dateField = null;
      
      if (deal.custom_fields_values) {
        for (var j = 0; j < deal.custom_fields_values.length; j++) {
          if (deal.custom_fields_values[j].field_id == this.FIELD_IDS.ORDER_DATE) {
            dateField = deal.custom_fields_values[j];
            break;
          }
        }
      }

      var date = (dateField && dateField.values && dateField.values[0] && dateField.values[0].value && dateField.values[0].value.split(" ")[0]) || 
                 new Date(deal.created_at * 1000).toISOString().split("T")[0];

      if (!result[date]) result[date] = [];
      result[date].push(deal);
    }
    return result;
  }

  async navigateMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    await this.renderCalendar();
  }

  setupEventListeners() {
    var prevMonthBtn = document.getElementById("prevMonth");
    var nextMonthBtn = document.getElementById("nextMonth");
    var authButton = document.getElementById("authButton");

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", this.navigateMonth.bind(this, -1));
    }
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", this.navigateMonth.bind(this, 1));
    }
    if (authButton) {
      authButton.addEventListener("click", function() {
        var params = new URLSearchParams();
        params.append("client_id", "92acc9ee-781d-49c5-a43d-9cb0e7f7a527");
        params.append("redirect_uri", "https://alerom2006.github.io/Calendar/oauth_callback.html");
        params.append("state", this.widgetInstanceId);
        window.location.href = "https://spacebakery1.amocrm.ru/oauth2/authorize?" + params.toString();
      }.bind(this));
    }
  }

  toggleAuthSection() {
    var authSection = document.getElementById("auth-section");
    if (authSection) {
      authSection.style.display = this.accessToken ? "none" : "block";
    }
  }

  showError(message) {
    var errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
    console.error(message);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  try {
    if (window.AmoCRM) {
      window.AmoCRM.onReady(function() {
        new OrdersCalendar();
      });
    } else {
      console.warn("AmoCRM API не загружен, запуск в standalone режиме");
      new OrdersCalendar();
    }
  } catch (error) {
    console.error("Ошибка инициализации виджета:", error);
    var errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = "Ошибка загрузки виджета. Пожалуйста, обновите страницу.";
    document.body.innerHTML = "";
    document.body.appendChild(errorDiv);
  }
});

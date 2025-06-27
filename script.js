class OrdersCalendar {
  constructor() {
    this.widgetInstanceId = Date.now();
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.accessToken = null;
    this.loadFieldIds();
    this.init();
  }

  async init() {
    try {
      if (!window.AmoCRM) {
        throw new Error("AmoCRM API not loaded");
      }

      await this.checkAuth();
      this.setupUI();
      await this.renderCalendar();
      this.setupEventListeners();
      this.toggleAuthSection();
    } catch (error) {
      this.showError(
        this.getTranslation("errors.initialization") + ": " + error.message
      );
      console.error("Initialization error:", error);
    }
  }

  loadFieldIds() {
    this.FIELD_IDS = {
      ORDER_DATE: window.widgetSettings?.deal_date_field_id || 885453,
      DELIVERY_RANGE: window.widgetSettings?.delivery_range_field || 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };
  }

  detectLanguage() {
    try {
      return (window.AmoCRM?.variant("lang") || "ru").startsWith("ru")
        ? "ru"
        : "en";
    } catch (e) {
      console.error("Language detection error:", e);
      return "ru";
    }
  }

  getTranslation(key) {
    var keys = key.split(".");
    var result = window.i18n;

    for (var k of keys) {
      result = result?.[k];
      if (result === undefined) return key;
    }

    return result || key;
  }

  async checkAuth() {
    try {
      this.accessToken = await this.getAccessToken();
      if (!this.accessToken) {
        console.warn("Access token not received");
        this.showError(this.getTranslation("auth.error"));
      }
    } catch (error) {
      console.error("Auth error:", error);
      this.showError(this.getTranslation("auth.error"));
    }
  }

  async getAccessToken() {
    try {
      if (window.AmoCRM?.widgets?.system) {
        var system = await window.AmoCRM.widgets.system(this.widgetInstanceId);
        return system?.access_token || null;
      }
      return null;
    } catch (error) {
      console.error("Token error:", error);
      return null;
    }
  }

  setupUI() {
    var monthYearElement = document.getElementById("currentMonthYear");
    if (monthYearElement) {
      monthYearElement.textContent = this.getCurrentMonthTitle();
    }

    var authButton = document.getElementById("authButton");
    if (authButton) {
      authButton.textContent = this.getTranslation("widget.api_key");
    }

    var dealsTitle = document.getElementById("deals-title");
    if (dealsTitle) {
      dealsTitle.textContent = this.getTranslation("widget.deal_date_field").replace(
        "{date}",
        ""
      );
    }
  }

  getCurrentMonthTitle() {
    var months = this.lang === "ru" 
      ? ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
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
      this.showError(this.getTranslation("errors.apiFailed"));
      console.error("Render error:", error);
    }
  }

  renderCalendarGrid(year, month, deals) {
    var calendarElement = document.getElementById("calendar");
    if (!calendarElement) return;

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var weekdays = this.lang === "ru" 
      ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    var html = '<div class="weekdays">';
    weekdays.forEach(function(day) {
      html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="days">';

    // Empty cells
    for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    // Days of month
    for (var day = 1; day <= daysInMonth; day++) {
      var date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      var dealCount = deals[date]?.length || 0;

      html += `
        <div class="day ${dealCount ? "has-deals" : ""}" data-date="${date}">
          ${day}
          ${dealCount ? `<span class="deal-count">${dealCount}</span>` : ""}
        </div>
      `;
    }

    calendarElement.innerHTML = html + "</div>";

    // Add click handlers
    var days = calendarElement.querySelectorAll(".day:not(.empty)");
    for (var i = 0; i < days.length; i++) {
      days[i].addEventListener("click", (function(day) {
        return function() {
          this.renderDeals(day.dataset.date, deals);
        }.bind(this);
      })(days[i]));
    }
  }

  renderDeals(date, deals) {
    var dealList = deals[date] || [];
    var dealsContainer = document.getElementById("deals");
    var dateElement = document.getElementById("selected-date");

    if (!dealsContainer || !dateElement) return;

    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (dealList.length === 0) {
      dealsContainer.innerHTML = `<div class="no-deals">${
        this.lang === "ru" ? "Нет заказов на эту дату" : "No orders for this date"
      }</div>`;
      return;
    }

    var dealsHTML = "";
    for (var i = 0; i < dealList.length; i++) {
      var deal = dealList[i];
      dealsHTML += `
        <div class="deal-card" onclick="window.AmoCRM?.openCard?.('lead', ${
          deal.id
        })">
          <div class="deal-name">${deal.name}</div>
          ${this.renderDealFields(deal)}
        </div>
      `;
    }
    dealsContainer.innerHTML = dealsHTML;
  }

  renderDealFields(deal) {
    var fields = {
      [this.FIELD_IDS.DELIVERY_RANGE]: this.lang === "ru" ? "Диапазон доставки" : "Delivery range",
      [this.FIELD_IDS.EXACT_TIME]: this.lang === "ru" ? "К точному времени" : "Exact time",
      [this.FIELD_IDS.ADDRESS]: this.lang === "ru" ? "Адрес" : "Address",
    };

    var fieldsHTML = "";
    var fieldKeys = Object.keys(fields);
    for (var i = 0; i < fieldKeys.length; i++) {
      var id = fieldKeys[i];
      var name = fields[id];
      var value = deal.custom_fields_values?.find(function(f) {
        return f.field_id == id;
      })?.values?.[0]?.value;
      
      if (value) {
        fieldsHTML += `<div class="deal-field"><strong>${name}:</strong> ${
          value || (this.lang === "ru" ? "не указано" : "not specified")
        }</div>`;
      }
    }
    return fieldsHTML;
  }

  async fetchDeals(year, month) {
    if (!this.accessToken) {
      this.showError(this.lang === "ru" ? "Ошибка авторизации" : "Auth error");
      return {};
    }

    try {
      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      var params = new URLSearchParams({
        "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
        "filter[custom_fields_values][from]": startDate,
        "filter[custom_fields_values][to]": endDate,
      });

      var response = await fetch(
        `https://spacebakery1.amocrm.ru/api/v4/leads?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      if (response.status === 401) {
        this.accessToken = await this.getAccessToken();
        return this.fetchDeals(year, month);
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return this.processDealsData(await response.json());
    } catch (error) {
      this.showError(this.lang === "ru" ? "Ошибка загрузки сделок" : "Failed to load deals");
      console.error("Fetch deals error:", error);
      return {};
    }
  }

  processDealsData(data) {
    if (!data?._embedded?.leads) return {};

    return data._embedded.leads.reduce(function(acc, deal) {
      var dateField = deal.custom_fields_values?.find(function(f) {
        return f.field_id == this.FIELD_IDS.ORDER_DATE;
      }.bind(this));
      var date =
        dateField?.values?.[0]?.value?.split(" ")[0] ||
        new Date(deal.created_at * 1000).toISOString().split("T")[0];

      if (!acc[date]) acc[date] = [];
      acc[date].push(deal);
      return acc;
    }.bind(this), {});
  }

  async navigateMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    await this.renderCalendar();
  }

  setupEventListeners() {
    document.getElementById("prevMonth")?.addEventListener("click", function() {
      this.navigateMonth(-1);
    }.bind(this));
    
    document.getElementById("nextMonth")?.addEventListener("click", function() {
      this.navigateMonth(1);
    }.bind(this));

    document.getElementById("authButton")?.addEventListener("click", function() {
      var params = new URLSearchParams({
        client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
        redirect_uri: "https://alerom2006.github.io/Calendar/oauth_callback.html",
        state: this.widgetInstanceId,
      });
      window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${params}`;
    }.bind(this));
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

// Initialize widget
document.addEventListener("DOMContentLoaded", function() {
  try {
    if (window.AmoCRM) {
      window.AmoCRM.onReady(function() {
        new OrdersCalendar();
      });
    } else {
      console.warn("AmoCRM API not loaded, running in standalone mode");
      new OrdersCalendar();
    }
  } catch (error) {
    console.error("Widget initialization error:", error);
    var errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = "Widget loading error";
      errorElement.classList.remove("d-none");
    }
  }
});

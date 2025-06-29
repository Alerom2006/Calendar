class OrdersCalendar {
  constructor() {
    this.widgetInstanceId = `widget-${Date.now()}`;
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.accessToken = null;
    this.isLoading = false;
    this.FIELD_IDS = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };
    this.dealsData = {};
    this.init();
  }

  detectLanguage() {
    return navigator.language.startsWith("ru") ? "ru" : "en";
  }

  async init() {
    try {
      await this.waitForAmoCRM();
      await this.checkAuth();
      this.loadFieldIdsFromSettings();
      this.setupUI();
      await this.safeSetupSettingsHandlers();
      await this.renderCalendar();
      this.setupEventListeners();
    } catch (error) {
      console.error("Initialization error:", error);
      this.showError(
        this.translate("Ошибка инициализации", "Initialization error")
      );
    }
  }

  async waitForAmoCRM() {
    if (typeof AmoCRM === "undefined") {
      this.showStandaloneWarning();
      return new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return new Promise((resolve) => {
      if (AmoCRM.onReady) {
        AmoCRM.onReady(resolve);
      } else {
        setTimeout(resolve, 1500);
      }
    });
  }

  async safeSetupSettingsHandlers() {
    if (!this.isSettingsApiAvailable()) {
      console.warn("Settings API unavailable - skipping setup");
      return;
    }

    try {
      var settings = await this.getSettingsInstance();
      if (!settings) return;

      if (typeof settings.onSave === "function") {
        settings.onSave(async () => {
          console.log("Settings saved");
          this.loadFieldIdsFromSettings();
          await this.renderCalendar();
          return true;
        });
      } else {
        console.warn("onSave method not available in settings");
      }
    } catch (error) {
      console.error("Settings handler setup failed:", error);
    }
  }

  isSettingsApiAvailable() {
    try {
      return (
        typeof AmoCRM !== "undefined" &&
        typeof AmoCRM.widgets !== "undefined" &&
        typeof AmoCRM.widgets.settings === "function"
      );
    } catch (e) {
      return false;
    }
  }

  async getSettingsInstance() {
    try {
      return await AmoCRM.widgets.settings(this.widgetInstanceId);
    } catch (error) {
      console.error("Failed to get settings instance:", error);
      return null;
    }
  }

  loadFieldIdsFromSettings() {
    if (window.widgetSettings) {
      this.FIELD_IDS.ORDER_DATE =
        window.widgetSettings.deal_date_field_id || this.FIELD_IDS.ORDER_DATE;
      this.FIELD_IDS.DELIVERY_RANGE =
        window.widgetSettings.delivery_range_field ||
        this.FIELD_IDS.DELIVERY_RANGE;
    }
    console.log("Using field IDs:", this.FIELD_IDS);
  }

  async checkAuth() {
    this.showLoading(true);
    try {
      if (this.isSystemApiAvailable()) {
        var system = await AmoCRM.widgets.system(this.widgetInstanceId);
        this.accessToken = system?.access_token || null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      this.showLoading(false);
    }
  }

  isSystemApiAvailable() {
    return (
      typeof AmoCRM !== "undefined" &&
      typeof AmoCRM.widgets !== "undefined" &&
      typeof AmoCRM.widgets.system === "function"
    );
  }

  setupUI() {
    this.updateElementText("currentMonthYear", this.getCurrentMonthTitle());
    this.updateElementText(
      "authButton",
      this.translate("Авторизоваться в amoCRM", "Authorize in amoCRM")
    );
  }

  updateElementText(elementId, text) {
    var element = document.getElementById(elementId);
    if (element) element.textContent = text;
  }

  translate(russianText, englishText) {
    return this.lang === "ru" ? russianText : englishText;
  }

  getCurrentMonthTitle() {
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

    return `${
      months[this.currentDate.getMonth()]
    } ${this.currentDate.getFullYear()}`;
  }

  async renderCalendar() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.showLoading(true);

    try {
      var year = this.currentDate.getFullYear();
      var month = this.currentDate.getMonth();

      this.updateElementText("currentMonthYear", this.getCurrentMonthTitle());
      this.dealsData = await this.fetchDeals(year, month);
      this.renderCalendarGrid(year, month);
    } catch (error) {
      console.error("Render error:", error);
      this.showError(
        this.translate("Ошибка загрузки данных", "Data loading error")
      );
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  renderCalendarGrid(year, month) {
    var calendarElement = document.getElementById("calendar");
    if (!calendarElement) return;

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var weekdays =
      this.lang === "ru"
        ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    var html = '<div class="weekdays">';
    weekdays.forEach((day) => (html += `<div class="weekday">${day}</div>`));
    html += '</div><div class="days">';

    // Empty days at start
    for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    // Month days
    for (var day = 1; day <= daysInMonth; day++) {
      var date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      var dealCount = this.dealsData[date]?.length || 0;

      html += `
        <div class="day ${dealCount ? "has-deals" : ""}" data-date="${date}">
          ${day}
          ${dealCount ? `<span class="deal-count">${dealCount}</span>` : ""}
        </div>
      `;
    }

    calendarElement.innerHTML = html + "</div>";

    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () => this.renderDeals(day.dataset.date));
    });
  }

  renderDeals(date) {
    var dealsContainer = document.getElementById("deals");
    var dateElement = document.getElementById("selected-date");
    if (!dealsContainer || !dateElement) return;

    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    var deals = this.dealsData[date] || [];
    dealsContainer.innerHTML = deals.length
      ? deals
          .map(
            (deal) => `
        <div class="deal-card">
          <div class="deal-name">${
            deal.name || this.translate("Без названия", "No name")
          }</div>
          ${this.renderDealFields(deal)}
        </div>
      `
          )
          .join("")
      : `<div class="no-deals">${this.translate(
          "Нет сделок на эту дату",
          "No deals for this date"
        )}</div>`;
  }

  renderDealFields(deal) {
    var fields = [
      {
        id: this.FIELD_IDS.DELIVERY_RANGE,
        name: this.translate("Доставка", "Delivery"),
      },
      { id: this.FIELD_IDS.EXACT_TIME, name: this.translate("Время", "Time") },
      { id: this.FIELD_IDS.ADDRESS, name: this.translate("Адрес", "Address") },
    ];

    return fields
      .map((field) => {
        var value = deal.custom_fields_values?.find(
          (f) => f.field_id == field.id
        )?.values?.[0]?.value;
        return value
          ? `<div class="deal-field"><strong>${field.name}:</strong> ${value}</div>`
          : "";
      })
      .join("");
  }

  async fetchDeals(year, month) {
    if (!this.accessToken) {
      console.log("No access token - skipping API request");
      return {};
    }

    var controller = new AbortController();
    var timeout = setTimeout(() => controller.abort(), 15000);

    try {
      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      var response = await fetch(
        `https://spacebakery1.amocrm.ru/api/v4/leads?${new URLSearchParams({
          "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
          "filter[custom_fields_values][from]": startDate,
          "filter[custom_fields_values][to]": endDate,
        })}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Requested-With": "XMLHttpRequest",
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return this.processDealsData(await response.json());
    } catch (error) {
      console.error("Fetch deals error:", error);
      this.showError(
        this.translate("Ошибка при загрузке сделок", "Error loading deals")
      );
      return {};
    } finally {
      clearTimeout(timeout);
    }
  }

  processDealsData(data) {
    if (!data?._embedded?.leads) return {};

    return data._embedded.leads.reduce((acc, deal) => {
      var dateField = deal.custom_fields_values?.find(
        (f) => f.field_id == this.FIELD_IDS.ORDER_DATE
      );
      var date =
        dateField?.values?.[0]?.value?.split(" ")[0] ||
        new Date(deal.created_at * 1000).toISOString().split("T")[0];

      if (!acc[date]) acc[date] = [];
      acc[date].push(deal);
      return acc;
    }, {});
  }

  async navigateMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    await this.renderCalendar();
  }

  setupEventListeners() {
    document
      .getElementById("prevMonth")
      ?.addEventListener("click", () => this.navigateMonth(-1));
    document
      .getElementById("nextMonth")
      ?.addEventListener("click", () => this.navigateMonth(1));
    document
      .getElementById("authButton")
      ?.addEventListener("click", () => this.handleAuth());
  }

  handleAuth() {
    window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${new URLSearchParams(
      {
        client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
        redirect_uri:
          "https://alerom2006.github.io/Calendar/oauth_callback.html",
        state: this.widgetInstanceId,
      }
    )}`;
  }

  showLoading(show) {
    var loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "block" : "none";
  }

  showError(message) {
    var errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
  }

  showStandaloneWarning() {
    var warning = document.createElement("div");
    warning.className = "alert alert-warning";
    warning.textContent = this.translate(
      "Виджет работает без интеграции с amoCRM",
      "Widget running without amoCRM integration"
    );
    document.body.prepend(warning);
  }
}

// Safe initialization with multiple fallbacks
function initializeWidget() {
  try {
    new OrdersCalendar();
  } catch (error) {
    console.error("Widget initialization failed:", error);
    var errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent =
        "Ошибка загрузки виджета. Пожалуйста, обновите страницу.";
      errorElement.classList.remove("d-none");
    }
  }
}

// Try to initialize with AmoCRM ready event
if (typeof AmoCRM !== "undefined" && AmoCRM.onReady) {
  AmoCRM.onReady(initializeWidget);
} else {
  // Fallback initialization
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initializeWidget, 1000);
  });
}

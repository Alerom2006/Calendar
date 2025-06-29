class OrdersCalendar {
  constructor() {
    this.widgetInstanceId = `widget-${Date.now()}`;
    this.currentDate = new Date();
    this.lang = navigator.language.startsWith("ru") ? "ru" : "en";
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
      if (AmoCRM.onReady) AmoCRM.onReady(resolve);
      else setTimeout(resolve, 1500);
    });
  }

  async safeSetupSettingsHandlers() {
    if (!this.isAmoApiCompletelyReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const settings = await this.getProtectedSettingsInstance();
    if (!settings) return;
    this.setupSaveHandlerWithFallbacks(settings);
  }

  isAmoApiCompletelyReady() {
    try {
      return [
        "AmoCRM",
        "AmoCRM.widgets",
        "AmoCRM.widgets.settings",
        "AmoCRM.onReady",
      ].every((method) =>
        method.split(".").reduce((obj, part) => obj && obj[part], window)
      );
    } catch (e) {
      return false;
    }
  }

  async getProtectedSettingsInstance() {
    try {
      if (typeof AmoCRM.widgets.settings !== "function") return null;
      const settings = await AmoCRM.widgets.settings(this.widgetInstanceId);
      return settings && typeof settings === "object" ? settings : null;
    } catch (error) {
      return null;
    }
  }

  setupSaveHandlerWithFallbacks(settings) {
    if (typeof settings.onSave === "function") {
      try {
        settings.onSave(async () => {
          await this.handleSettingsSave();
          return true;
        });
        return;
      } catch (e) {}
    }

    if (typeof settings.setOnSave === "function") {
      try {
        settings.setOnSave(async () => {
          await this.handleSettingsSave();
          return true;
        });
        return;
      } catch (e) {}
    }

    if (Object.getPrototypeOf(settings).hasOwnProperty("onSave")) {
      try {
        Object.getPrototypeOf(settings).onSave = async () => {
          await this.handleSettingsSave();
          return true;
        };
        return;
      } catch (e) {}
    }
  }

  async handleSettingsSave() {
    try {
      this.loadFieldIdsFromSettings();
      await this.renderCalendar();
    } catch (error) {}
  }

  loadFieldIdsFromSettings() {
    if (window.widgetSettings) {
      this.FIELD_IDS.ORDER_DATE =
        window.widgetSettings.deal_date_field_id || this.FIELD_IDS.ORDER_DATE;
      this.FIELD_IDS.DELIVERY_RANGE =
        window.widgetSettings.delivery_range_field ||
        this.FIELD_IDS.DELIVERY_RANGE;
    }
  }

  async checkAuth() {
    this.showLoading(true);
    try {
      if (this.isSystemApiAvailable()) {
        const system = await AmoCRM.widgets.system(this.widgetInstanceId);
        this.accessToken = system?.access_token || null;
      }
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
    const element = document.getElementById(elementId);
    if (element) element.textContent = text;
  }

  translate(russianText, englishText) {
    return this.lang === "ru" ? russianText : englishText;
  }

  getCurrentMonthTitle() {
    const months =
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
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      this.updateElementText("currentMonthYear", this.getCurrentMonthTitle());
      this.dealsData = await this.fetchDeals(year, month);
      this.renderCalendarGrid(year, month);
    } catch (error) {
      this.showError(
        this.translate("Ошибка загрузки данных", "Data loading error")
      );
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  renderCalendarGrid(year, month) {
    const calendarElement = document.getElementById("calendar");
    if (!calendarElement) return;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays =
      this.lang === "ru"
        ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    let html = '<div class="weekdays">';
    weekdays.forEach((day) => (html += `<div class="weekday">${day}</div>`));
    html += '</div><div class="days">';

    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealCount = this.dealsData[date]?.length || 0;
      html += `<div class="day ${
        dealCount ? "has-deals" : ""
      }" data-date="${date}">
        ${day}${dealCount ? `<span class="deal-count">${dealCount}</span>` : ""}
      </div>`;
    }

    calendarElement.innerHTML = html + "</div>";
    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () => this.renderDeals(day.dataset.date));
    });
  }

  renderDeals(date) {
    const dealsContainer = document.getElementById("deals");
    const dateElement = document.getElementById("selected-date");
    if (!dealsContainer || !dateElement) return;

    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const deals = this.dealsData[date] || [];
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
    const fields = [
      {
        id: this.FIELD_IDS.DELIVERY_RANGE,
        name: this.translate("Доставка", "Delivery"),
      },
      { id: this.FIELD_IDS.EXACT_TIME, name: this.translate("Время", "Time") },
      { id: this.FIELD_IDS.ADDRESS, name: this.translate("Адрес", "Address") },
    ];

    return fields
      .map((field) => {
        const value = deal.custom_fields_values?.find(
          (f) => f.field_id == field.id
        )?.values?.[0]?.value;
        return value
          ? `<div class="deal-field"><strong>${field.name}:</strong> ${value}</div>`
          : "";
      })
      .join("");
  }

  async fetchDeals(year, month) {
    if (!this.accessToken) return {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
      const response = await fetch(
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
      const dateField = deal.custom_fields_values?.find(
        (f) => f.field_id == this.FIELD_IDS.ORDER_DATE
      );
      const date =
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
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = show ? "block" : "none";
  }

  showError(message) {
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
  }

  showStandaloneWarning() {
    const warning = document.createElement("div");
    warning.className = "alert alert-warning";
    warning.textContent = this.translate(
      "Виджет работает без интеграции с amoCRM",
      "Widget running without amoCRM integration"
    );
    document.body.prepend(warning);
  }
}

function initializeWidget() {
  try {
    if (
      !document.getElementById("calendar") ||
      !document.getElementById("error-alert")
    )
      return;
    const initTimeout = setTimeout(() => {}, 5000);
    const widget = new OrdersCalendar();
    clearTimeout(initTimeout);
    setTimeout(() => {
      if (widget.isLoading) {
        widget.showLoading(false);
        widget.showError("Виджет завис при инициализации");
      }
    }, 10000);
  } catch (error) {
    const errorElement =
      document.getElementById("error-alert") || document.createElement("div");
    errorElement.textContent = `ОШИБКА: ${
      typeof error === "string" ? error : error.message || "Неизвестная ошибка"
    }`;
    errorElement.className = "alert alert-danger";
    errorElement.style.display = "block";
    if (!document.body.contains(errorElement))
      document.body.prepend(errorElement);
  }
}

if (typeof AmoCRM !== "undefined" && AmoCRM.onReady) {
  AmoCRM.onReady(() => setTimeout(initializeWidget, 300));
} else {
  document.addEventListener("DOMContentLoaded", () =>
    setTimeout(initializeWidget, 1500)
  );
}

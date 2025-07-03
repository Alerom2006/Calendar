class OrdersCalendarWidget {
  constructor(params = {}) {
    this.config = {
      debugMode: true,
      version: "1.0.5",
    };

    this.state = {
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      isLoading: false,
      context: this.detectContext(params),
      entityType: params?.entity_type || "leads",
      accountDomain: this.extractAccountDomain(),
      widgetParams: params,
    };

    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    this.i18n = {
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
      errors: {
        load: "Ошибка загрузки данных",
        noDeals: "Нет сделок на выбранную дату",
        noAuth: "Требуется авторизация в amoCRM",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
      },
    };

    this.initialize();
  }

  detectContext(params) {
    if (typeof AmoProxySDK !== "undefined") return "proxy_sdk";
    if (typeof AmoSDK !== "undefined" && params?.entity_type) return "card_sdk";
    if (typeof AmoCRM !== "undefined") return "widget";
    if (window.location.pathname.includes("settings")) return "settings";
    return "standalone";
  }

  extractAccountDomain() {
    if (typeof AmoCRM !== "undefined")
      return AmoCRM.widgets.system?.account || "";
    if (this.state.widgetParams?.account)
      return this.state.widgetParams.account;
    return window.location.hostname.split(".")[0] || "";
  }

  initialize() {
    try {
      switch (this.state.context) {
        case "proxy_sdk":
          this.initProxySDKMode();
          break;
        case "card_sdk":
          this.initCardSDKMode();
          break;
        case "widget":
          this.initWidgetMode();
          break;
        case "settings":
          this.initSettingsMode();
          break;
        default:
          this.initStandaloneMode();
      }
    } catch (error) {
      this.showFatalError();
    }
  }

  initProxySDKMode() {
    AmoProxySDK.init().then(() => {
      this.applySettings(AmoProxySDK.getSettings());
      this.initUI();
      this.loadData().then(() => this.renderCalendar());
    });
  }

  initCardSDKMode() {
    this.applySettings(this.state.widgetParams.settings || {});
    this.initUI();
    this.loadData().then(() => this.renderCalendar());
  }

  initWidgetMode() {
    AmoCRM.widgets.system().then((system) => {
      this.applySettings(system.settings || {});
      this.initUI();
      this.loadData().then(() => this.renderCalendar());
    });
  }

  initSettingsMode() {
    document.getElementById("widget_container").innerHTML = `
      <div class="settings-container">
        <h2>Настройки календаря заказов</h2>
        <div class="form-group">
          <label>ID поля даты заказа:</label>
          <input type="number" id="dealDateField" value="${this.fieldIds.ORDER_DATE}">
        </div>
        <div class="form-group">
          <label>ID поля диапазона доставки:</label>
          <input type="number" id="deliveryRangeField" value="${this.fieldIds.DELIVERY_RANGE}">
        </div>
        <button id="saveSettings" class="btn btn-primary">Сохранить</button>
      </div>
    `;
    document
      .getElementById("saveSettings")
      .addEventListener("click", () => this.saveSettings());
  }

  initStandaloneMode() {
    this.showAuthScreen();
  }

  applySettings(settings) {
    if (settings?.deal_date_field_id)
      this.fieldIds.ORDER_DATE =
        parseInt(settings.deal_date_field_id) || this.fieldIds.ORDER_DATE;
    if (settings?.delivery_range_field)
      this.fieldIds.DELIVERY_RANGE =
        parseInt(settings.delivery_range_field) || this.fieldIds.DELIVERY_RANGE;
  }

  saveSettings() {
    const newSettings = {
      deal_date_field_id:
        parseInt(document.getElementById("dealDateField").value) ||
        this.fieldIds.ORDER_DATE,
      delivery_range_field:
        parseInt(document.getElementById("deliveryRangeField").value) ||
        this.fieldIds.DELIVERY_RANGE,
    };

    if (this.state.context === "proxy_sdk") {
      AmoProxySDK.saveSettings(newSettings).then(() =>
        this.showMessage("Настройки сохранены!")
      );
    } else if (typeof AmoSDK !== "undefined") {
      AmoSDK.saveSettings(newSettings).then(() =>
        this.showMessage("Настройки сохранены!")
      );
    } else if (typeof AmoCRM !== "undefined") {
      AmoCRM.widgets.system().then((system) => {
        system
          .saveSettings(newSettings)
          .then(() => this.showMessage("Настройки сохранены!"));
      });
    }
  }

  initUI() {
    if (
      this.state.context === "card_sdk" ||
      this.state.context === "proxy_sdk"
    ) {
      document.getElementById("calendar-mode").style.display = "none";
      document.getElementById("deal-widget-mode").style.display = "block";
      this.container = document.getElementById("deal-widget-content");
      this.container.className = "deal-widget-mode";
      this.container.innerHTML = `
        <div class="deal-widget">
          <h3>Календарь заказов</h3>
          <div class="deal-date">
            <button id="openCalendar" class="btn">Открыть календарь</button>
          </div>
        </div>
      `;
      document
        .getElementById("openCalendar")
        .addEventListener("click", () => this.showFullCalendar());
    } else {
      this.container = document.getElementById("widget_container");
      this.bindEvents();
    }
  }

  showFullCalendar() {
    this.container.innerHTML = `
      <div class="calendar-header">
        <button class="nav-button prev-month">&lt;</button>
        <h3 class="current-month"></h3>
        <button class="nav-button next-month">&gt;</button>
      </div>
      <div class="calendar-grid"></div>
      <div class="deals-container">
        <h4 class="deals-title">${this.i18n.labels.dealsFor} <span class="selected-date">${this.i18n.labels.selectDate}</span></h4>
        <div class="deals-list"></div>
      </div>
    `;
    this.bindEvents();
    this.renderCalendar();
  }

  bindEvents() {
    const prevBtn =
      this.container.querySelector(".prev-month") ||
      document.getElementById("prevMonth");
    const nextBtn =
      this.container.querySelector(".next-month") ||
      document.getElementById("nextMonth");
    if (prevBtn) prevBtn.addEventListener("click", () => this.prevMonth());
    if (nextBtn) nextBtn.addEventListener("click", () => this.nextMonth());
    const authBtn = document.getElementById("authButton");
    if (authBtn)
      authBtn.addEventListener("click", () =>
        window.open(
          `https://${this.state.accountDomain}.amocrm.ru/oauth2/authorize`,
          "_blank"
        )
      );
  }

  async loadData() {
    if (this.state.isLoading) return;
    this.state.isLoading = true;
    this.showLoader();

    try {
      const dateFrom = new Date(
        this.state.currentDate.getFullYear(),
        this.state.currentDate.getMonth() - 1,
        1
      );
      const dateTo = new Date(
        this.state.currentDate.getFullYear(),
        this.state.currentDate.getMonth() + 2,
        0
      );

      let deals = [];
      if (this.state.context === "proxy_sdk") {
        deals = await AmoProxySDK.getLeads({
          filter: {
            [this.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        });
      } else if (
        this.state.context === "card_sdk" &&
        typeof AmoSDK !== "undefined"
      ) {
        deals = await AmoSDK.getLeads({
          filter: {
            [this.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        });
      } else if (typeof AmoCRM !== "undefined") {
        const response = await AmoCRM.request("/api/v4/leads", {
          filter: {
            [this.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        });
        deals = response._embedded?.leads || [];
      }

      this.processDealsData(deals);
      return deals;
    } finally {
      this.state.isLoading = false;
      this.hideLoader();
    }
  }

  processDealsData(deals) {
    this.state.dealsData = {};
    deals.forEach((deal) => {
      const dateField = deal.custom_fields_values?.find(
        (field) => field.field_id === this.fieldIds.ORDER_DATE
      );
      if (dateField?.values?.[0]?.value) {
        const dateStr = new Date(dateField.values[0].value * 1000)
          .toISOString()
          .split("T")[0];
        if (!this.state.dealsData[dateStr]) this.state.dealsData[dateStr] = [];
        this.state.dealsData[dateStr].push({
          id: deal.id,
          name: deal.name,
          price: deal.price,
          status_id: deal.status_id,
          custom_fields: {
            [this.fieldIds.DELIVERY_RANGE]: this.getCustomFieldValue(
              deal,
              this.fieldIds.DELIVERY_RANGE
            ),
            [this.fieldIds.EXACT_TIME]: this.getCustomFieldValue(
              deal,
              this.fieldIds.EXACT_TIME
            ),
            [this.fieldIds.ADDRESS]: this.getCustomFieldValue(
              deal,
              this.fieldIds.ADDRESS
            ),
          },
        });
      }
    });
  }

  getCustomFieldValue(deal, fieldId) {
    const field = deal.custom_fields_values?.find(
      (f) => f.field_id === fieldId
    );
    return field?.values?.[0]?.value || null;
  }

  renderCalendar() {
    const month = this.state.currentDate.getMonth();
    const year = this.state.currentDate.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const monthTitle =
      this.container.querySelector(".current-month") ||
      document.getElementById("currentMonthYear");
    if (monthTitle)
      monthTitle.textContent = `${this.i18n.months[month]} ${year}`;

    let calendarHTML = "";
    this.i18n.weekdays.forEach(
      (day) => (calendarHTML += `<div class="weekday">${day}</div>`)
    );
    for (let i = 0; i < startDay; i++)
      calendarHTML += '<div class="calendar-day empty"></div>';

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealsCount = this.state.dealsData[dateStr]?.length || 0;
      const isToday = this.isToday(dateStr);
      const dayClass = `calendar-day ${isToday ? "today" : ""} ${
        dealsCount > 0 ? "has-deals" : ""
      }`;

      calendarHTML += `
        <div class="${dayClass}" data-date="${dateStr}">
          ${day}${
        dealsCount > 0 ? `<span class="deal-count">${dealsCount}</span>` : ""
      }
        </div>
      `;
    }

    const calendarGrid =
      this.container.querySelector(".calendar-grid") ||
      document.getElementById("calendar");
    if (calendarGrid) calendarGrid.innerHTML = calendarHTML;

    const days =
      this.container.querySelectorAll(".calendar-day:not(.empty)") ||
      document.querySelectorAll(".calendar-day:not(.empty)");
    days.forEach((day) =>
      day.addEventListener("click", () =>
        this.showDealsForDate(day.dataset.date)
      )
    );

    if (this.state.selectedDate) this.showDealsForDate(this.state.selectedDate);
  }

  isToday(dateStr) {
    const today = new Date();
    const checkDate = new Date(dateStr);
    return (
      checkDate.getDate() === today.getDate() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear()
    );
  }

  showDealsForDate(date) {
    this.state.selectedDate = date;
    const dateElement =
      this.container.querySelector(".selected-date") ||
      document.getElementById("selected-date");
    if (dateElement) {
      const dateObj = new Date(date);
      dateElement.textContent = dateObj.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    const deals = this.state.dealsData[date] || [];
    let dealsHTML = "";
    if (deals.length === 0) {
      dealsHTML = `<div class="no-deals">${this.i18n.errors.noDeals}</div>`;
    } else {
      deals
        .sort((a, b) => b.id - a.id)
        .forEach((deal) => {
          dealsHTML += `
          <div class="deal-item" data-deal-id="${deal.id}">
            <div class="deal-header">
              <span class="deal-id">#${deal.id}</span>
              <span class="deal-status">${this.getStatusName(
                deal.status_id
              )}</span>
            </div>
            <div class="deal-name">${deal.name}</div>
            <div class="deal-price">${
              deal.price ? `${deal.price} руб.` : "—"
            }</div>
            <div class="deal-field">
              <span>Доставка:</span> ${
                deal.custom_fields[this.fieldIds.DELIVERY_RANGE] || "—"
              }
            </div>
            <div class="deal-field">
              <span>Адрес:</span> ${
                deal.custom_fields[this.fieldIds.ADDRESS] || "—"
              }
            </div>
          </div>
        `;
        });
    }

    const dealsList =
      this.container.querySelector(".deals-list") ||
      document.getElementById("deals");
    if (dealsList) dealsList.innerHTML = dealsHTML;

    const dealItems =
      this.container.querySelectorAll(".deal-item") ||
      document.querySelectorAll(".deal-item");
    dealItems.forEach((deal) =>
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      })
    );
  }

  getStatusName(statusId) {
    const statuses = {
      142: "Новая",
      143: "В работе",
      144: "Завершена",
      145: "Отменена",
    };
    return statuses[statusId] || `Статус #${statusId}`;
  }

  openDealCard(dealId) {
    if (this.state.context === "proxy_sdk") {
      AmoProxySDK.openCard(parseInt(dealId));
    } else if (
      this.state.context === "card_sdk" &&
      typeof AmoSDK !== "undefined"
    ) {
      AmoSDK.openCard(parseInt(dealId));
    } else if (typeof AmoCRM !== "undefined") {
      AmoCRM.widgets
        .system()
        .then((system) => system.openCard(parseInt(dealId)));
    } else {
      window.open(
        `https://${this.state.accountDomain}.amocrm.ru/leads/detail/${dealId}`,
        "_blank"
      );
    }
  }

  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.loadData().then(() => this.renderCalendar());
  }

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.loadData().then(() => this.renderCalendar());
  }

  showAuthScreen() {
    document.getElementById("widget_container").innerHTML = `
      <div class="auth-container text-center py-5">
        <h2 class="mb-4">Календарь заказов</h2>
        <p class="mb-4">${this.i18n.errors.noAuth}</p>
        <button id="authButton" class="btn btn-primary px-4">
          <span class="me-2">🔒</span>
          ${this.i18n.labels.authButton}
        </button>
      </div>
    `;
    document
      .getElementById("authButton")
      .addEventListener("click", () =>
        window.open(
          `https://${this.state.accountDomain}.amocrm.ru/oauth2/authorize`,
          "_blank"
        )
      );
  }

  showLoader() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "block";
  }

  hideLoader() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "none";
  }

  showError(message) {
    const errorEl = document.getElementById("error-alert");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove("d-none");
      setTimeout(() => errorEl.classList.add("d-none"), 5000);
    }
  }

  showMessage(message) {
    const alertEl = document.createElement("div");
    alertEl.className = "alert alert-success position-fixed top-0 end-0 m-3";
    alertEl.textContent = message;
    document.body.appendChild(alertEl);
    setTimeout(() => alertEl.remove(), 3000);
  }

  showFatalError() {
    document.getElementById("widget_container").innerHTML = `
      <div class="alert alert-danger">
        Произошла критическая ошибка при загрузке виджета. Пожалуйста, обновите страницу.
      </div>
    `;
  }
}

function initializeWidget() {
  if (typeof AmoProxySDK !== "undefined") {
    AmoProxySDK.init().then((params) => new OrdersCalendarWidget(params));
  } else if (typeof AmoSDK !== "undefined") {
    AmoSDK.init().then((params) => new OrdersCalendarWidget(params));
  } else if (typeof AmoCRM !== "undefined") {
    AmoCRM.widgets.system().then((system) => {
      if (system.location === "llist" || system.location === "culist") {
        AmoCRM.widgets.on("selected", function () {
          new OrdersCalendarWidget(system.params);
        });
      } else {
        new OrdersCalendarWidget(system.params);
      }
    });
  } else {
    new OrdersCalendarWidget();
  }
}

document.addEventListener("DOMContentLoaded", initializeWidget);
if (typeof render === "function") render();

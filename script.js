class OrdersCalendarWidget {
  constructor() {
    this.widgetInstance = null;
    this.currentDate = new Date();
    this.lang = "ru";
    this.accessToken = null;
    this.dealsData = {};
    this.fieldIds = {
      orderDate: 885453,
      deliveryRange: 892009,
    };
  }

  async init() {
    try {
      await this.waitForAmoReady();
      this.widgetInstance = await this.createWidgetInstance();
      await this.setupWidget();
    } catch (error) {
      console.error("Widget init failed:", error);
      this.showError("Ошибка инициализации виджета");
    }
  }

  async waitForAmoReady() {
    return new Promise((resolve) => {
      if (typeof AmoCRM !== "undefined" && AmoCRM.onReady) {
        AmoCRM.onReady(resolve);
      } else {
        setTimeout(resolve, 1000);
      }
    });
  }

  async createWidgetInstance() {
    return new Promise((resolve) => {
      if (typeof AmoCRM === "undefined" || !AmoCRM.widgets) {
        resolve(null);
        return;
      }

      AmoCRM.widgets.create(
        "OrdersCalendarWidget",
        (widget) => resolve(widget),
        { ext_id: "com.alerom.calendar" }
      );
    });
  }

  async setupWidget() {
    if (!this.widgetInstance) {
      this.showStandaloneWarning();
      return;
    }

    this.lang = this.widgetInstance.getLang() || "ru";
    this.accessToken = this.widgetInstance.getToken();

    await this.loadSettings();
    this.setupEventListeners();
    await this.renderCalendar();
  }

  async loadSettings() {
    try {
      const settings = await this.widgetInstance.loadSettings();
      if (settings) {
        this.fieldIds.orderDate =
          settings.deal_date_field_id || this.fieldIds.orderDate;
        this.fieldIds.deliveryRange =
          settings.delivery_range_field || this.fieldIds.deliveryRange;
      }
    } catch (error) {
      console.error("Settings load error:", error);
    }
  }

  async renderCalendar() {
    try {
      this.widgetInstance.showLoading(true);

      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      this.dealsData = await this.fetchDeals(year, month);

      this.widgetInstance.render({
        template: this.getCalendarTemplate(year, month),
        data: {
          monthTitle: this.getMonthTitle(),
          deals: this.dealsData,
        },
      });
    } catch (error) {
      console.error("Render error:", error);
      this.showError("Ошибка загрузки данных");
    } finally {
      this.widgetInstance.showLoading(false);
    }
  }

  getCalendarTemplate(year, month) {
    const weekdays =
      this.lang === "ru"
        ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    let html = `<div class="calendar">
      <div class="calendar-header">
        <button class="prev-month">&lt;</button>
        <h2>${this.getMonthTitle()}</h2>
        <button class="next-month">&gt;</button>
      </div>
      <div class="weekdays">${weekdays
        .map((day) => `<div>${day}</div>`)
        .join("")}</div>
      <div class="days">`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealsCount = this.dealsData[date]?.length || 0;
      html += `<div class="day" data-date="${date}">
        ${day}${dealsCount ? `<span class="badge">${dealsCount}</span>` : ""}
      </div>`;
    }

    return html + "</div></div>";
  }

  async fetchDeals(year, month) {
    if (!this.accessToken) return {};

    try {
      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      const response = await this.widgetInstance.request({
        url: `/api/v4/leads?${new URLSearchParams({
          "filter[custom_fields_values][field_id]": this.fieldIds.orderDate,
          "filter[custom_fields_values][from]": startDate,
          "filter[custom_fields_values][to]": endDate,
        })}`,
        method: "GET",
      });

      return this.processDealsData(response.data);
    } catch (error) {
      console.error("Fetch deals error:", error);
      return {};
    }
  }

  processDealsData(data) {
    if (!data?._embedded?.leads) return {};

    return data._embedded.leads.reduce((acc, deal) => {
      const dateField = deal.custom_fields_values?.find(
        (f) => f.field_id == this.fieldIds.orderDate
      );
      const date =
        dateField?.values?.[0]?.value?.split(" ")[0] ||
        new Date(deal.created_at * 1000).toISOString().split("T")[0];

      if (!acc[date]) acc[date] = [];
      acc[date].push(deal);
      return acc;
    }, {});
  }

  getMonthTitle() {
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

  setupEventListeners() {
    this.widgetInstance.on("prevMonth", () => this.navigateMonth(-1));
    this.widgetInstance.on("nextMonth", () => this.navigateMonth(1));
    this.widgetInstance.on("dayClick", (date) => this.showDeals(date));

    this.widgetInstance.on("settingsSave", async () => {
      await this.loadSettings();
      await this.renderCalendar();
      return true;
    });
  }

  async navigateMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    await this.renderCalendar();
  }

  showDeals(date) {
    const deals = this.dealsData[date] || [];
    this.widgetInstance.render({
      template: `
        <div class="deals-list">
          <h3>Сделки на ${new Date(date).toLocaleDateString(this.lang)}</h3>
          ${
            deals.length
              ? deals
                  .map(
                    (deal) => `
              <div class="deal-card">
                <div class="deal-name">${deal.name || "Без названия"}</div>
                ${this.renderDealFields(deal)}
              </div>
            `
                  )
                  .join("")
              : '<div class="no-deals">Нет сделок на эту дату</div>'
          }
        </div>
      `,
    });
  }

  renderDealFields(deal) {
    const fields = [
      { id: this.fieldIds.deliveryRange, name: "Доставка" },
      { id: this.fieldIds.exactTime, name: "Время" },
      { id: this.fieldIds.address, name: "Адрес" },
    ];

    return fields
      .map((field) => {
        const value = deal.custom_fields_values?.find(
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
  }

  showError(message) {
    this.widgetInstance.render({
      template: `<div class="error-message">${message}</div>`,
    });
  }

  showStandaloneWarning() {
    console.warn("Widget runs without amoCRM integration");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new OrdersCalendarWidget().init();
});

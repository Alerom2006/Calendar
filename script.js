class OrdersCalendarWidget {
  constructor() {
    this.widget = null;
    this.currentDate = new Date();
    this.lang = "ru";
    this.fieldIds = {
      orderDate: 885453,
      deliveryRange: 892009,
    };
  }

  async init() {
    try {
      await this.waitForAMO();
      this.setupWidget();
      await this.loadSettings();
      await this.render();
    } catch (error) {
      console.error("Widget init error:", error);
      this.showError("Ошибка загрузки виджета");
    }
  }

  async waitForAMO() {
    return new Promise((resolve) => {
      if (typeof AmoCRM !== "undefined" && AmoCRM.onReady) {
        AmoCRM.onReady(resolve);
      } else {
        setTimeout(resolve, 1000);
      }
    });
  }

  setupWidget() {
    if (typeof AmoCRM === "undefined" || !AmoCRM.widgets) {
      this.showStandaloneWarning();
      return;
    }

    this.widget = AmoCRM.widgets.create("OrdersCalendar", {
      onSave: async () => {
        await this.handleSettingsSave();
        return { status: "success" };
      },
      onInit: async () => {
        this.accessToken = this.widget.getToken();
        this.lang = this.widget.getLang() || "ru";
      },
    });
  }

  async loadSettings() {
    try {
      const settings = (await this.widget?.loadSettings()) || {};
      this.fieldIds.orderDate =
        settings.deal_date_field_id || this.fieldIds.orderDate;
      this.fieldIds.deliveryRange =
        settings.delivery_range_field || this.fieldIds.deliveryRange;
    } catch (error) {
      console.warn("Settings load error:", error);
    }
  }

  async handleSettingsSave() {
    await this.loadSettings();
    await this.render();
  }

  async render() {
    try {
      this.widget?.showLoading(true);
      const deals = await this.fetchDeals();

      this.widget?.render({
        template: this.getTemplate(deals),
        data: {
          month: this.getMonthName(),
          year: this.currentDate.getFullYear(),
        },
      });
    } finally {
      this.widget?.showLoading(false);
    }
  }

  async fetchDeals() {
    if (!this.accessToken) return {};

    try {
      const response = await fetch(this.getDealsUrl(), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      return response.ok ? this.processData(await response.json()) : {};
    } catch (error) {
      console.error("Fetch error:", error);
      return {};
    }
  }

  getDealsUrl() {
    const start = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth(),
      1
    )
      .toISOString()
      .split("T")[0];
    const end = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0
    )
      .toISOString()
      .split("T")[0];

    return `https://${this.widget.getDomain()}/api/v4/leads?${new URLSearchParams(
      {
        "filter[custom_fields_values][field_id]": this.fieldIds.orderDate,
        "filter[custom_fields_values][from]": start,
        "filter[custom_fields_values][to]": end,
      }
    )}`;
  }

  getTemplate(deals) {
    return `
      <div class="calendar">
        ${this.getHeader()}
        ${this.getDaysGrid(deals)}
      </div>
    `;
  }

  getHeader() {
    return `
      <div class="header">
        <button class="prev">&lt;</button>
        <h2>${this.getMonthName()} ${this.currentDate.getFullYear()}</h2>
        <button class="next">&gt;</button>
      </div>
    `;
  }

  getDaysGrid(deals) {
    const days = [];
    const daysInMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      0
    ).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${this.currentDate.getFullYear()}-${(
        this.currentDate.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      days.push(`
        <div class="day" data-date="${date}">
          ${day}
          ${
            deals[date]?.length
              ? `<span class="count">${deals[date].length}</span>`
              : ""
          }
        </div>
      `);
    }

    return `<div class="days">${days.join("")}</div>`;
  }

  getMonthName() {
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
    return months[this.currentDate.getMonth()];
  }

  showError(message) {
    const container = document.getElementById("widget-container");
    if (container) {
      container.innerHTML = `<div class="error">${message}</div>`;
    }
  }

  showStandaloneWarning() {
    console.warn("Widget runs in standalone mode");
  }
}

// Инициализация с защитой от ошибок
try {
  document.addEventListener("DOMContentLoaded", () => {
    new OrdersCalendarWidget().init();
  });
} catch (error) {
  console.error("Global widget error:", error);
}

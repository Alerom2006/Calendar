class OrdersCalendarWidget {
  constructor(params) {
    this.params = params || {};
    this.state = {
      currentDate: new Date(),
      selectedDate: null,
      dealsData: {},
      isLoading: false,
    };
    this.fieldIds = {
      ORDER_DATE: this.params.settings?.deal_date_field || 885453,
    };
  }

  async init() {
    try {
      if (this.isSDKMode()) {
        await this.initSDK();
      } else {
        await this.initWidget();
      }
      this.render();
    } catch (error) {
      console.error("Widget init error:", error);
      this.showError("Ошибка инициализации виджета");
    }
  }

  isSDKMode() {
    return typeof AmoSDK !== "undefined";
  }

  async initSDK() {
    const sdk = await AmoSDK.init();
    this.sdk = sdk;
    this.container = document.createElement("div");
    document.body.appendChild(this.container);
  }

  async initWidget() {
    const system = await AmoCRM.widgets.system();
    this.system = system;
    this.container = system.getContainer();
  }

  render() {
    this.container.innerHTML = `
      <div class="widget-calendar">
        <div class="calendar-header">
          <button class="nav-button prev-month">&lt;</button>
          <h3 class="current-month"></h3>
          <button class="nav-button next-month">&gt;</button>
        </div>
        <div class="calendar-grid"></div>
        <div class="deals-container">
          <h4 class="deals-title">Сделки на <span class="selected-date">выберите дату</span></h4>
          <div class="deals-list"></div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.updateCalendar();
  }

  bindEvents() {
    this.container
      .querySelector(".prev-month")
      .addEventListener("click", () => this.prevMonth());
    this.container
      .querySelector(".next-month")
      .addEventListener("click", () => this.nextMonth());
  }

  async updateCalendar() {
    this.state.isLoading = true;
    this.showLoader();

    try {
      const deals = await this.loadDeals();
      this.processDealsData(deals);
      this.renderCalendar();
    } catch (error) {
      console.error("Error updating calendar:", error);
      this.showError("Ошибка загрузки данных");
    } finally {
      this.state.isLoading = false;
      this.hideLoader();
    }
  }

  async loadDeals() {
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

    if (this.isSDKMode()) {
      return this.sdk.getLeads({
        filter: {
          [this.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
      });
    } else {
      const response = await AmoCRM.request("/api/v4/leads", {
        filter: {
          [this.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
      });
      return response._embedded?.leads || [];
    }
  }

  processDealsData(deals) {
    this.state.dealsData = {};
    deals.forEach((deal) => {
      const dateField = deal.custom_fields_values?.find(
        (f) => f.field_id === this.fieldIds.ORDER_DATE
      );
      if (dateField?.values?.[0]?.value) {
        const dateStr = new Date(dateField.values[0].value * 1000)
          .toISOString()
          .split("T")[0];
        if (!this.state.dealsData[dateStr]) this.state.dealsData[dateStr] = [];
        this.state.dealsData[dateStr].push(deal);
      }
    });
  }

  renderCalendar() {
    const month = this.state.currentDate.getMonth();
    const year = this.state.currentDate.getFullYear();
    const monthNames = [
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
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

    this.container.querySelector(
      ".current-month"
    ).textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    let calendarHTML = weekdays
      .map((day) => `<div class="weekday">${day}</div>`)
      .join("");

    for (let i = 0; i < startDay; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>';
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealsCount = this.state.dealsData[dateStr]?.length || 0;
      const isToday = this.isToday(dateStr);
      const dayClass = `calendar-day ${isToday ? "today" : ""} ${
        dealsCount ? "has-deals" : ""
      }`;

      calendarHTML += `
        <div class="${dayClass}" data-date="${dateStr}">
          ${day}
          ${dealsCount ? `<span class="deal-count">${dealsCount}</span>` : ""}
        </div>
      `;
    }

    this.container.querySelector(".calendar-grid").innerHTML = calendarHTML;

    this.container
      .querySelectorAll(".calendar-day:not(.empty)")
      .forEach((day) => {
        day.addEventListener("click", () =>
          this.showDealsForDate(day.dataset.date)
        );
      });
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
    const dateObj = new Date(date);
    this.container.querySelector(".selected-date").textContent =
      dateObj.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

    const deals = this.state.dealsData[date] || [];
    let dealsHTML = "";

    if (deals.length === 0) {
      dealsHTML = '<div class="no-deals">Нет сделок на выбранную дату</div>';
    } else {
      deals
        .sort((a, b) => b.id - a.id)
        .forEach((deal) => {
          dealsHTML += `
          <div class="deal-item" data-deal-id="${deal.id}">
            <div class="deal-name">${deal.name}</div>
            <div class="deal-price">${deal.price || 0} руб.</div>
          </div>
        `;
        });
    }

    this.container.querySelector(".deals-list").innerHTML = dealsHTML;

    this.container.querySelectorAll(".deal-item").forEach((deal) => {
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      });
    });
  }

  openDealCard(dealId) {
    if (this.isSDKMode()) {
      this.sdk.openCard(parseInt(dealId));
    } else {
      this.system.openCard(parseInt(dealId));
    }
  }

  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.updateCalendar();
  }

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.updateCalendar();
  }

  showLoader() {
    this.container.querySelector(".widget-calendar").classList.add("loading");
  }

  hideLoader() {
    this.container
      .querySelector(".widget-calendar")
      .classList.remove("loading");
  }

  showError(message) {
    const errorEl = document.createElement("div");
    errorEl.className = "error-message";
    errorEl.textContent = message;
    this.container.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
  }

  bind_actions() {
    console.log("Widget actions bound");
  }

  advancedSettings() {
    return {
      render: () => "<div>Расширенные настройки календаря</div>",
      bind_actions: () => console.log("Advanced settings actions bound"),
    };
  }

  onSave() {
    return new Promise((resolve) => {
      console.log("Settings saved");
      resolve(true);
    });
  }

  destroy() {
    if (this.container && !this.isSDKMode()) {
      this.container.remove();
    }
  }
}

if (typeof AmoSDK !== "undefined") {
  AmoSDK.init().then((params) => {
    const widget = new OrdersCalendarWidget(params);
    widget.init();
  });
} else if (typeof AmoCRM !== "undefined") {
  const widget = new OrdersCalendarWidget();

  AmoCRM.widgets.on("render", (params) => {
    widget.params = params;
    widget.init();
  });

  AmoCRM.widgets.on("bind_actions", () => widget.bind_actions());
  AmoCRM.widgets.on("advanced_settings", () => widget.advancedSettings());
  AmoCRM.widgets.on("save", () => widget.onSave());
  AmoCRM.widgets.on("destroy", () => widget.destroy());
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = OrdersCalendarWidget;
}

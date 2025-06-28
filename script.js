class OrdersCalendar {
  constructor() {
    this.widgetInstanceId = `widget-${Date.now()}`;
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.accessToken = null;
    this.isLoading = false;
    this.loadingTimeout = null;
    this.dealsData = {}; // Кэш для данных о сделках
    this.loadFieldIds();
    this.init();
  }

  async init() {
    try {
      // Проверка доступности API amoCRM
      if (typeof AmoCRM !== "undefined") {
        await this.initAmoCRM();
      } else {
        this.showStandaloneWarning();
      }

      await this.checkAuth();
      this.setupUI();
      await this.setupSettingsHandlers();
      await this.renderCalendar();
      this.setupEventListeners();
    } catch (error) {
      console.error("Init error:", error);
      this.showError("Ошибка инициализации виджета");
    }
  }

  async initAmoCRM() {
    return new Promise((resolve) => {
      if (typeof AmoCRM !== "undefined" && AmoCRM.onReady) {
        AmoCRM.onReady(() => {
          console.log("AmoCRM API ready");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  loadFieldIds() {
    this.FIELD_IDS = {
      ORDER_DATE: window.widgetSettings?.deal_date_field_id || 885453,
      DELIVERY_RANGE: window.widgetSettings?.delivery_range_field || 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };
    console.log("Field IDs loaded:", this.FIELD_IDS);
  }

  async setupSettingsHandlers() {
    try {
      if (typeof AmoCRM === "undefined" || !AmoCRM.widgets?.settings) {
        console.log("Settings API not available");
        return;
      }

      const settings = await AmoCRM.widgets.settings(this.widgetInstanceId);

      if (settings?.onSave) {
        settings.onSave(async () => {
          console.log("Settings saved");
          this.loadFieldIds();
          await this.renderCalendar();
          return true;
        });
      }
    } catch (error) {
      console.error("Settings handler error:", error);
    }
  }

  async checkAuth() {
    try {
      this.showLoading(true);
      if (typeof AmoCRM !== "undefined" && AmoCRM.widgets?.system) {
        const system = await AmoCRM.widgets.system(this.widgetInstanceId);
        this.accessToken = system?.access_token || null;
      }
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      this.showLoading(false);
    }
  }

  setupUI() {
    // Обновляем текущий месяц/год
    const monthYearElement = document.getElementById("currentMonthYear");
    if (monthYearElement) {
      monthYearElement.textContent = this.getCurrentMonthTitle();
    }

    // Обновляем текст кнопки авторизации
    const authButton = document.getElementById("authButton");
    if (authButton) {
      authButton.textContent =
        this.lang === "ru" ? "Авторизоваться в amoCRM" : "Authorize in amoCRM";
    }
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

    try {
      this.showLoading(true);
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();

      // Обновляем заголовок
      const monthYearElement = document.getElementById("currentMonthYear");
      if (monthYearElement) {
        monthYearElement.textContent = this.getCurrentMonthTitle();
      }

      // Загружаем данные
      this.dealsData = await this.fetchDeals(year, month);

      // Рендерим календарь
      this.renderCalendarGrid(year, month);
    } catch (error) {
      console.error("Render error:", error);
      this.showError(
        this.lang === "ru" ? "Ошибка загрузки данных" : "Data loading error"
      );
    } finally {
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
    weekdays.forEach((day) => {
      html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="days">';

    // Пустые дни в начале месяца
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealCount = this.dealsData[date]?.length || 0;

      html += `
        <div class="day ${dealCount ? "has-deals" : ""}" data-date="${date}">
          ${day}
          ${dealCount ? `<span class="deal-count">${dealCount}</span>` : ""}
        </div>
      `;
    }

    calendarElement.innerHTML = html + "</div>";

    // Назначаем обработчики кликов
    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () => {
        this.renderDeals(day.dataset.date);
      });
    });
  }

  renderDeals(date) {
    const dealsContainer = document.getElementById("deals");
    const dateElement = document.getElementById("selected-date");

    if (!dealsContainer || !dateElement) return;

    // Форматируем дату
    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const deals = this.dealsData[date] || [];

    if (deals.length === 0) {
      dealsContainer.innerHTML = `
        <div class="no-deals">
          ${
            this.lang === "ru"
              ? "Нет сделок на эту дату"
              : "No deals for this date"
          }
        </div>
      `;
      return;
    }

    // Рендерим список сделок
    dealsContainer.innerHTML = deals
      .map(
        (deal) => `
      <div class="deal-card">
        <div class="deal-name">${deal.name || "Без названия"}</div>
        ${this.renderDealFields(deal)}
      </div>
    `
      )
      .join("");
  }

  renderDealFields(deal) {
    const fields = [
      {
        id: this.FIELD_IDS.DELIVERY_RANGE,
        name: this.lang === "ru" ? "Доставка" : "Delivery",
      },
      {
        id: this.FIELD_IDS.EXACT_TIME,
        name: this.lang === "ru" ? "Время" : "Time",
      },
      {
        id: this.FIELD_IDS.ADDRESS,
        name: this.lang === "ru" ? "Адрес" : "Address",
      },
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

  async fetchDeals(year, month) {
    if (!this.accessToken) {
      console.log("No access token - skipping API request");
      return {};
    }

    try {
      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      const params = new URLSearchParams({
        "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
        "filter[custom_fields_values][from]": startDate,
        "filter[custom_fields_values][to]": endDate,
      });

      const response = await fetch(
        `https://spacebakery1.amocrm.ru/api/v4/leads?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return this.processDealsData(await response.json());
    } catch (error) {
      console.error("Fetch deals error:", error);
      return {};
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
    // Навигация по месяцам
    document.getElementById("prevMonth")?.addEventListener("click", () => {
      this.navigateMonth(-1);
    });

    document.getElementById("nextMonth")?.addEventListener("click", () => {
      this.navigateMonth(1);
    });

    // Авторизация
    document.getElementById("authButton")?.addEventListener("click", () => {
      this.handleAuth();
    });
  }

  handleAuth() {
    const params = new URLSearchParams({
      client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
      redirect_uri: "https://alerom2006.github.io/Calendar/oauth_callback.html",
      state: this.widgetInstanceId,
    });
    window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${params}`;
  }

  showLoading(show) {
    this.isLoading = show;
    const loader = document.getElementById("loader");
    if (loader) {
      loader.style.display = show ? "block" : "none";
    }
  }

  showError(message) {
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
  }

  showStandaloneWarning() {
    console.warn("Running in standalone mode");
    const warning = document.createElement("div");
    warning.className = "alert alert-warning";
    warning.textContent =
      this.lang === "ru"
        ? "Виджет работает без интеграции с amoCRM"
        : "Widget running without amoCRM integration";
    document.body.prepend(warning);
  }
}

// Инициализация виджета
document.addEventListener("DOMContentLoaded", () => {
  try {
    new OrdersCalendar();
  } catch (error) {
    console.error("Widget initialization failed:", error);
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = "Ошибка загрузки виджета";
      errorElement.classList.remove("d-none");
    }
  }
});

class OrdersCalendar {
  constructor() {
    this.widgetInstanceId = Date.now().toString();
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.accessToken = null;
    this.isLoading = false;
    this.loadingTimeout = null;
    this.loadingRetries = 0;
    this.MAX_RETRIES = 3;
    this.settingsHandlerInstalled = false;
    this.loadFieldIds();
    this.init();
  }

  async init() {
    try {
      // Проверка доступности API amoCRM
      if (!window.AmoCRM) {
        console.warn("AmoCRM API не доступен - автономный режим");
        this.showStandaloneWarning();
      }

      await this.checkAuth();
      this.setupUI();
      await this.setupSettingsHandlers();
      await this.renderCalendar();
      this.setupEventListeners();
      this.toggleAuthSection();
    } catch (error) {
      console.error("Ошибка инициализации:", error);
      this.handleCriticalError("Ошибка загрузки виджета");
    }
  }

  async setupSettingsHandlers() {
    // Основной метод настройки
    await this.tryStandardSettingsSetup();

    // Fallback через 2 секунды если основной не сработал
    setTimeout(() => {
      if (!this.settingsHandlerInstalled) {
        this.installFallbackSettingsHandler();
      }
    }, 2000);
  }

  async tryStandardSettingsSetup() {
    try {
      if (!window.AmoCRM?.widgets?.settings) {
        console.log("API настроек недоступно");
        return;
      }

      const settings = await window.AmoCRM.widgets.settings(
        this.widgetInstanceId
      );

      if (settings && typeof settings.onSave === "function") {
        settings.onSave(async () => {
          console.log("Стандартный обработчик сохранения настроек");
          await this.handleSettingsSave();
          return true;
        });
        this.settingsHandlerInstalled = true;
        console.log("Стандартный обработчик настроек установлен");
      }
    } catch (error) {
      console.error("Ошибка настройки стандартного обработчика:", error);
    }
  }

  installFallbackSettingsHandler() {
    console.log("Попытка установки fallback обработчика");
    const saveButton = document.querySelector(
      '[data-qa="save-settings-button"], .settings-save-btn'
    );

    if (saveButton) {
      saveButton.addEventListener("click", () => {
        setTimeout(() => {
          console.log("Fallback обработчик сохранения настроек");
          this.handleSettingsSave();
        }, 500);
      });
      this.settingsHandlerInstalled = true;
      console.log("Fallback обработчик настроек установлен");
    } else {
      console.warn("Не удалось найти кнопку сохранения настроек");
    }
  }

  async handleSettingsSave() {
    try {
      this.showLoading(true);
      console.log("Обновление настроек...");
      await this.loadFieldIds();
      await this.renderCalendar();
    } catch (error) {
      console.error("Ошибка обработки сохранения:", error);
    } finally {
      this.showLoading(false);
    }
  }

  loadFieldIds() {
    const defaultSettings = {
      deal_date_field_id: 885453,
      delivery_range_field: 892009,
    };

    this.FIELD_IDS = {
      ORDER_DATE:
        window.widgetSettings?.deal_date_field_id ||
        defaultSettings.deal_date_field_id,
      DELIVERY_RANGE:
        window.widgetSettings?.delivery_range_field ||
        defaultSettings.delivery_range_field,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    console.log("Поля загружены:", this.FIELD_IDS);
  }

  detectLanguage() {
    try {
      return (
        window.AmoCRM?.variant("lang") ||
        navigator.language ||
        "ru"
      ).startsWith("ru")
        ? "ru"
        : "en";
    } catch (e) {
      return "ru";
    }
  }

  getTranslation(key) {
    const keys = key.split(".");
    let result = window.i18n || {};

    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) return key;
    }

    return result || key;
  }

  async checkAuth() {
    try {
      this.showLoading(true);
      this.accessToken = await this.getAccessToken();

      if (!this.accessToken) {
        console.warn("Токен доступа не получен");
      }
    } catch (error) {
      console.error("Ошибка авторизации:", error);
    } finally {
      this.showLoading(false);
    }
  }

  async getAccessToken() {
    try {
      if (window.AmoCRM?.widgets?.system) {
        const system = await window.AmoCRM.widgets.system(
          this.widgetInstanceId
        );
        return system?.access_token || null;
      }
      return null;
    } catch (error) {
      console.error("Ошибка получения токена:", error);
      return null;
    }
  }

  setupUI() {
    const monthYearElement = document.getElementById("currentMonthYear");
    if (monthYearElement) {
      monthYearElement.textContent = this.getCurrentMonthTitle();
    }

    const authButton = document.getElementById("authButton");
    if (authButton) {
      authButton.textContent = this.getTranslation("widget.api_key");
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

      document.getElementById("currentMonthYear").textContent =
        this.getCurrentMonthTitle();
      const deals = await this.fetchDeals(year, month);
      this.renderCalendarGrid(year, month, deals);
    } catch (error) {
      console.error("Ошибка отрисовки календаря:", error);
      this.showError(this.getTranslation("errors.apiFailed"));
    } finally {
      this.showLoading(false);
    }
  }

  renderCalendarGrid(year, month, deals) {
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

    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealCount = deals[date]?.length || 0;

      html += `
        <div class="day ${dealCount ? "has-deals" : ""}" data-date="${date}">
          ${day}
          ${dealCount ? `<span class="deal-count">${dealCount}</span>` : ""}
        </div>
      `;
    }

    calendarElement.innerHTML = html + "</div>";

    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () =>
        this.renderDeals(day.dataset.date, deals)
      );
    });
  }

  async fetchDeals(year, month) {
    if (!this.accessToken) return {};

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

      if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
      return this.processDealsData(await response.json());
    } catch (error) {
      console.error("Ошибка загрузки сделок:", error);
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
    const params = new URLSearchParams({
      client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
      redirect_uri: "https://alerom2006.github.io/Calendar/oauth_callback.html",
      state: this.widgetInstanceId,
    });
    window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${params}`;
  }

  toggleAuthSection() {
    const authSection = document.getElementById("auth-section");
    if (authSection) {
      authSection.style.display = this.accessToken ? "none" : "block";
    }
  }

  async showLoading(show) {
    if (this.loadingTimeout) clearTimeout(this.loadingTimeout);

    this.isLoading = show;
    const loader = document.getElementById("loader");

    if (loader) {
      loader.style.display = show ? "block" : "none";
    }

    if (show) {
      this.loadingTimeout = setTimeout(() => {
        if (this.isLoading) {
          this.loadingRetries++;
          if (this.loadingRetries >= this.MAX_RETRIES) {
            this.handleCriticalError("Превышено время ожидания");
          } else {
            console.warn(`Повторная попытка #${this.loadingRetries}`);
            this.showLoading(false);
            this.init();
          }
        }
      }, 15000);
    } else {
      this.loadingRetries = 0;
    }
  }

  handleCriticalError(message) {
    console.error("CRITICAL:", message);
    this.showLoading(false);

    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.innerHTML = `
        ${message}
        <button onclick="location.reload()" class="btn btn-sm btn-danger mt-2">
          Перезагрузить виджет
        </button>
      `;
      errorElement.classList.remove("d-none");
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
    const warning = document.createElement("div");
    warning.className = "alert alert-warning";
    warning.textContent =
      this.lang === "ru"
        ? "Виджет работает в автономном режиме (без интеграции с amoCRM)"
        : "Widget is running in standalone mode (without amoCRM integration)";
    document.body.prepend(warning);
  }
}

// Инициализация с улучшенной обработкой ошибок
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (window.AmoCRM) {
      window.AmoCRM.onReady(() => {
        new OrdersCalendar();
      }).catch((error) => {
        console.error("Ошибка готовности amoCRM:", error);
        new OrdersCalendar();
      });
    } else {
      new OrdersCalendar();
    }
  } catch (error) {
    console.error("Критическая ошибка инициализации:", error);
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.innerHTML = `
        Ошибка загрузки виджета
        <button onclick="location.reload()" class="btn btn-sm btn-danger mt-2">
          Перезагрузить
        </button>
      `;
    }
  }
});

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
    
    // Долгосрочный токен (действителен до 2030 года)
    this.LONG_TERM_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjQ0ZjEyMjI0NTVmZWQzYzI1ZTY3MDMyODRiYmI1ZGM1OTQ2ZGY3NjQ0ZmIxMzgxYTY3NzJjYzM1NGMyMjVhOGY3NTE2MDUyYzg0NWIyYWYxIn0.eyJhdWQiOiI5MmFjYzllZS03ODFkLTQ5YzUtYTQzZC05Y2IwZTdmN2E1MjciLCJqdGkiOiI0NGYxMjIyNDU1ZmVkM2MyNWU2NzAzMjg0YmJiNWRjNTk0NmRmNzY0NGZiMTM4MWE2NzcyY2MzNTRjMjI1YThmNzUxNjA1MmM4NDViMmFmMSIsImlhdCI6MTc1MDg1MjE1MCwibmJmIjoxNzUwODUyMTUwLCJleHAiOjE5MDg1NzYwMDAsInN1YiI6IjEwNDgwMDQ2IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMxNDcyMTEwLCJiYXNlX2RvbWFpbiI6ImFtb2NybS5ydSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJjcm0iLCJmaWxlcyIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiLCJwdXNoX25vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiYmIxNzdiZjMtZjlkNC00ZDhkLTg2NTItN2UwNWQ1N2I5M2E1IiwiYXBpX2RvbWFpbiI6ImFwaS1iLmFtb2NybS5ydSJ9.cQH4gp1Oi2G1XcmEACpUZTqPGfW6P78DWN62CbOcRBXPNAAnDuCIfCruFtGFgoUJFqWj3m_RZKowEuKId0lr9xDkp-25p9rPlFK-bcJ2nhT8CYPx4tUBHhVqbMZjtcqFucC3JBWSvqVu-NYdw0ogv2qxQUXhsovNQaBHH-qADDJgiIyaC_YoiXfsTS637zYJGuqWIjKsq8KzDzNTegGhBuV4iWz2FmW0qYkkEOrIA31lorYKp9SNMF4VoXAc06uoCXyY7--YeifUvc_FrD4X9bwshrxz9lHn32_LhdEMO6owVfuG0GOLhbWnRflIYiqwBBIdXXq8xozl_SWfaja8Ag";

    // Состояние виджета
    this.widgetInstanceId = Date.now();
    this.accessToken = this.LONG_TERM_TOKEN; // Используем долгосрочный токен по умолчанию
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.i18n = this.loadTranslations();
    this.isRefreshingToken = false;

    // Инициализация
    this.init();
  }

  // ==================== Основные методы ====================

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
      this.showError(`Ошибка инициализации: ${error.message}`);
      console.error(error);
    }
  }

  // ==================== Вспомогательные методы ====================

  detectLanguage() {
    try {
      return (window.AmoCRM?.constant("lang") || "ru").startsWith("ru")
        ? "ru"
        : "en";
    } catch (e) {
      console.error("Ошибка определения языка:", e);
      return "ru";
    }
  }

  loadTranslations() {
    const fallbackTranslations = {
      ru: {
        widget: {
          name: "Календарь заказов",
          description: "Виджет для отображения сделок по датам заказа",
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
          address: "Адрес",
        },
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
          fetch_deals: "Ошибка при получении сделок",
          connection: "Ошибка соединения",
          auth: "Ошибка авторизации"
        },
      },
      en: {
        widget: {
          name: "Orders Calendar",
          description: "Widget for displaying deals by order date",
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
          address: "Address",
        },
        months: [
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
        ],
        weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        errors: {
          fetch_deals: "Error fetching deals",
          connection: "Connection error",
          auth: "Authorization error"
        },
      },
    };

    try {
      const amoTranslations =
        window.AmoCRM?.widgets?.i18n?.getTranslations?.() || {};
      return { ...fallbackTranslations[this.lang], ...amoTranslations };
    } catch (e) {
      console.error("Ошибка загрузки переводов:", e);
      return fallbackTranslations[this.lang];
    }
  }

  // ==================== Работа с API ====================

  async checkAuth() {
    this.accessToken = await this.getAccessToken();
    if (!this.accessToken) {
      console.warn("Токен доступа не получен");
      this.showError(this.i18n.errors?.auth || "Ошибка авторизации");
    }
  }

  async getAccessToken(forceRefresh = false) {
    // Если уже в процессе обновления токена, возвращаем текущий
    if (this.isRefreshingToken) {
      return this.accessToken;
    }

    try {
      // 1. Пробуем получить свежий токен через AmoCRM API, если требуется обновление
      if (forceRefresh || !this.LONG_TERM_TOKEN) {
        this.isRefreshingToken = true;
        const freshToken = await window.AmoCRM?.widgets
          ?.system(this.widgetInstanceId)
          ?.then((s) => s?.access_token)
          ?.catch(() => null);
        
        if (freshToken) {
          this.accessToken = freshToken;
          this.storeToken(freshToken);
          return freshToken;
        }
      }

      // 2. Пробуем получить из localStorage
      const storedToken = this.retrieveStoredToken();
      if (storedToken) {
        this.accessToken = storedToken;
        return storedToken;
      }

      // 3. Возвращаем долгосрочный токен как fallback
      return this.LONG_TERM_TOKEN;
    } catch (error) {
      console.error("Ошибка получения токена:", error);
      return this.LONG_TERM_TOKEN; // Всегда возвращаем долгосрочный токен как запасной вариант
    } finally {
      this.isRefreshingToken = false;
    }
  }

  storeToken(token) {
    try {
      localStorage.setItem(`amo_token_${this.widgetInstanceId}`, token);
    } catch (e) {
      console.warn("Не удалось сохранить токен в localStorage:", e);
    }
  }

  retrieveStoredToken() {
    try {
      return localStorage.getItem(`amo_token_${this.widgetInstanceId}`);
    } catch (e) {
      console.warn("Не удалось получить токен из localStorage:", e);
      return null;
    }
  }

  // ==================== Рендеринг ====================

  setupUI() {
    document.getElementById("currentMonthYear").textContent =
      this.getCurrentMonthTitle();
  }

  getCurrentMonthTitle() {
    return `${this.i18n.months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
  }

  async renderCalendar() {
    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();

      document.getElementById("currentMonthYear").textContent =
        this.getCurrentMonthTitle();

      const deals = await this.fetchDeals(year, month);
      this.renderCalendarGrid(year, month, deals);
    } catch (error) {
      this.showError(`Ошибка отображения календаря: ${error.message}`);
    }
  }

  renderCalendarGrid(year, month, deals) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = '<div class="weekdays">';
    this.i18n.weekdays.forEach((day) => {
      html += `<div class="weekday">${day}</div>`;
    });

    html += '</div><div class="days">';

    // Пустые ячейки
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dealCount = deals[date]?.length || 0;

      html += `
        <div class="day ${dealCount ? "has-deals" : ""}" data-date="${date}">
          ${day}
          ${dealCount ? `<span class="deal-count">${dealCount}</span>` : ""}
        </div>
      `;
    }

    const calendarElement = document.getElementById("calendar");
    calendarElement.innerHTML = html + "</div>";

    // Обработчики кликов
    calendarElement.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () =>
        this.renderDeals(day.dataset.date, deals)
      );
    });
  }

  renderDeals(date, deals) {
    const dealList = deals[date] || [];
    const dealsContainer = document.getElementById("deals");
    const dateElement = document.getElementById("selected-date");

    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (dealList.length === 0) {
      dealsContainer.innerHTML = `<div class="no-deals">${this.i18n.noDeals}</div>`;
      return;
    }

    dealsContainer.innerHTML = dealList
      .map(
        (deal) => `
      <div class="deal-card" onclick="window.AmoCRM?.openCard('lead', ${deal.id})">
        <div class="deal-name">${deal.name}</div>
        ${this.renderDealFields(deal)}
      </div>
    `
      )
      .join("");
  }

  renderDealFields(deal) {
    return Object.entries({
      [this.FIELD_IDS.DELIVERY_RANGE]: this.i18n.fields.delivery,
      [this.FIELD_IDS.EXACT_TIME]: this.i18n.fields.exactTime,
      [this.FIELD_IDS.ADDRESS]: this.i18n.fields.address,
    })
      .map(([id, name]) => {
        const value = deal.custom_fields_values?.find((f) => f.field_id == id)
          ?.values?.[0]?.value;
        return value
          ? `<div class="deal-field"><strong>${name}:</strong> ${value}</div>`
          : "";
      })
      .join("");
  }

  // ==================== Работа со сделками ====================

  async fetchDeals(year, month) {
    try {
      // Всегда сначала проверяем/обновляем токен
      this.accessToken = await this.getAccessToken();
      
      if (!this.accessToken) {
        this.showError(this.i18n.errors?.auth || "Ошибка авторизации");
        return {};
      }

      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      const params = new URLSearchParams({
        "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
        "filter[custom_fields_values][from]": startDate,
        "filter[custom_fields_values][to]": endDate,
      });

      const response = await fetch(`${this.API_URL}leads?${params}`, {
        headers: { 
          Authorization: `Bearer ${this.accessToken}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        },
      });

      if (response.status === 401) {
        // Если токен недействителен, пробуем обновить его принудительно
        this.accessToken = await this.getAccessToken(true);
        return this.fetchDeals(year, month); // Рекурсивный повтор запроса
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return this.processDealsData(await response.json());
    } catch (error) {
      this.showError(
        this.i18n.errors?.fetch_deals || "Ошибка при получении сделок"
      );
      console.error("Ошибка получения сделок:", error);
      return {};
    }
  }

  processDealsData(data) {
    if (!data._embedded?.leads) return {};

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

  // ==================== Навигация ====================

  async navigateMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    await this.renderCalendar();
  }

  // ==================== Обработчики событий ====================

  setupEventListeners() {
    document
      .getElementById("prevMonth")
      .addEventListener("click", () => this.navigateMonth(-1));
    document
      .getElementById("nextMonth")
      .addEventListener("click", () => this.navigateMonth(1));

    document.getElementById("authButton").addEventListener("click", () => {
      const params = new URLSearchParams({
        client_id: "92acc9ee-781d-49c5-a43d-9cb0e7f7a527",
        redirect_uri: "https://alerom2006.github.io/Calendar/oauth_callback.html",
        state: this.widgetInstanceId,
      });
      window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${params}`;
    });
  }

  toggleAuthSection() {
    document.getElementById("auth-section").style.display = this.accessToken
      ? "none"
      : "block";
  }

  // ==================== Обработка ошибок ====================

  showError(message) {
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
    console.error(message);
  }
}

// Инициализация виджета
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (window.AmoCRM) {
      window.AmoCRM.onReady(() => new OrdersCalendar());
    } else {
      console.warn("AmoCRM API не загружен, запуск в standalone режиме");
      new OrdersCalendar();
    }
  } catch (error) {
    console.error("Ошибка инициализации виджета:", error);
    document.body.innerHTML = `<div class="error">Ошибка загрузки виджета. Пожалуйста, обновите страницу.</div>`;
  }
});

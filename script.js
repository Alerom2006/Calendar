class OrdersCalendar {
  constructor() {
    this.widgetInstanceId = Date.now();
    this.currentDate = new Date();
    this.lang = this.detectLanguage();
    this.accessToken = null;
    this.isLoading = false;
    this.loadingTimeout = null;
    this.loadFieldIds();
    this.init();
  }

  // Основная инициализация виджета
  async init() {
    try {
      // Проверяем доступность API amoCRM
      if (!window.AmoCRM) {
        console.warn("AmoCRM API не загружен");
        this.showStandaloneWarning();
      }

      await this.checkAuth();
      this.setupUI();
      await this.setupSettingsHandlers();
      await this.renderCalendar();
      this.setupEventListeners();
      this.toggleAuthSection();
    } catch (error) {
      this.showError(
        `${this.getTranslation("errors.initialization")}: ${error.message}`
      );
      console.error("Ошибка инициализации:", error);
    }
  }

  // Загрузка ID полей из настроек виджета
  loadFieldIds() {
    const defaultSettings = {
      deal_date_field_id: 885453, // ID поля даты заказа по умолчанию
      delivery_range_field: 892009, // ID поля диапазона доставки по умолчанию
    };

    this.FIELD_IDS = {
      ORDER_DATE:
        window.widgetSettings?.deal_date_field_id ||
        defaultSettings.deal_date_field_id,
      DELIVERY_RANGE:
        window.widgetSettings?.delivery_range_field ||
        defaultSettings.delivery_range_field,
      EXACT_TIME: 892003, // ID поля точного времени
      ADDRESS: 887367, // ID поля адреса
    };
  }

  // Настройка обработчиков сохранения настроек
  async setupSettingsHandlers() {
    try {
      if (window.AmoCRM?.widgets?.settings) {
        const settings = await window.AmoCRM.widgets.settings(
          this.widgetInstanceId
        );

        if (settings?.onSave) {
          settings.onSave(async () => {
            try {
              this.showLoading(true);
              this.loadFieldIds(); // Перезагружаем ID полей
              await this.renderCalendar(); // Обновляем календарь
              return true; // Подтверждаем успешное сохранение
            } catch (error) {
              console.error("Ошибка при сохранении настроек:", error);
              return false;
            } finally {
              this.showLoading(false);
            }
          });
        }
      }
    } catch (error) {
      console.error("Ошибка настройки обработчиков:", error);
      this.showError("Ошибка при настройке обработчиков сохранения");
    }
  }

  // Определение языка интерфейса
  detectLanguage() {
    try {
      return (window.AmoCRM?.variant("lang") || "ru").startsWith("ru")
        ? "ru"
        : "en";
    } catch (e) {
      console.error("Ошибка определения языка:", e);
      return "ru";
    }
  }

  // Получение перевода по ключу
  getTranslation(key) {
    const keys = key.split(".");
    let result = window.i18n || {};

    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) return key;
    }

    return result || key;
  }

  // Проверка авторизации
  async checkAuth() {
    try {
      this.showLoading(true);
      this.accessToken = await this.getAccessToken();

      if (!this.accessToken) {
        console.warn("Токен доступа не получен");
        this.showError(this.getTranslation("auth.error"));
      }
    } catch (error) {
      console.error("Ошибка авторизации:", error);
      this.showError(this.getTranslation("auth.error"));
    } finally {
      this.showLoading(false);
    }
  }

  // Получение токена доступа
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

  // Настройка элементов интерфейса
  setupUI() {
    const monthYearElement = document.getElementById("currentMonthYear");
    if (monthYearElement) {
      monthYearElement.textContent = this.getCurrentMonthTitle();
    }

    const authButton = document.getElementById("authButton");
    if (authButton) {
      authButton.textContent = this.getTranslation("widget.api_key");
    }

    const dealsTitle = document.getElementById("deals-title");
    if (dealsTitle) {
      dealsTitle.textContent = this.getTranslation("widget.deal_date_field");
    }
  }

  // Получение названия текущего месяца и года
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

  // Отрисовка календаря
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
      this.showError(this.getTranslation("errors.apiFailed"));
      console.error("Ошибка отрисовки календаря:", error);
    } finally {
      this.showLoading(false);
    }
  }

  // Отрисовка сетки календаря
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

    // Пустые ячейки для первого дня
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    // Дни месяца
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

    // Обработчики кликов по дням
    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () => {
        this.renderDeals(day.dataset.date, deals);
      });
    });
  }

  // Отрисовка списка сделок
  renderDeals(date, deals) {
    const dealList = deals[date] || [];
    const dealsContainer = document.getElementById("deals");
    const dateElement = document.getElementById("selected-date");

    if (!dealsContainer || !dateElement) return;

    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    if (dealList.length === 0) {
      dealsContainer.innerHTML = `
        <div class="no-deals">
          ${
            this.lang === "ru"
              ? "Нет заказов на эту дату"
              : "No orders for this date"
          }
        </div>
      `;
      return;
    }

    dealsContainer.innerHTML = dealList
      .map(
        (deal) => `
        <div class="deal-card" onclick="window.AmoCRM?.openCard?.('lead', ${
          deal.id
        })">
          <div class="deal-name">${deal.name}</div>
          ${this.renderDealFields(deal)}
        </div>
      `
      )
      .join("");
  }

  // Отрисовка полей сделки
  renderDealFields(deal) {
    const fields = {
      [this.FIELD_IDS.DELIVERY_RANGE]:
        this.lang === "ru" ? "Диапазон доставки" : "Delivery range",
      [this.FIELD_IDS.EXACT_TIME]:
        this.lang === "ru" ? "К точному времени" : "Exact time",
      [this.FIELD_IDS.ADDRESS]: this.lang === "ru" ? "Адрес" : "Address",
    };

    return Object.entries(fields)
      .map(([id, name]) => {
        const value = deal.custom_fields_values?.find((f) => f.field_id == id)
          ?.values?.[0]?.value;
        return value
          ? `<div class="deal-field">
               <strong>${name}:</strong> ${
              value || (this.lang === "ru" ? "не указано" : "not specified")
            }
             </div>`
          : "";
      })
      .join("");
  }

  // Загрузка сделок из API
  async fetchDeals(year, month) {
    if (!this.accessToken) {
      this.showError(this.getTranslation("auth.error"));
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

      if (response.status === 401) {
        this.accessToken = await this.getAccessToken();
        return this.accessToken ? this.fetchDeals(year, month) : {};
      }

      if (!response.ok) {
        throw new Error(`HTTP ошибка: ${response.status}`);
      }

      return this.processDealsData(await response.json());
    } catch (error) {
      this.showError(
        `${this.getTranslation("errors.apiFailed")}: ${error.message}`
      );
      console.error("Ошибка загрузки сделок:", error);
      return {};
    }
  }

  // Обработка данных о сделках
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

  // Навигация по месяцам
  async navigateMonth(offset) {
    this.currentDate.setMonth(this.currentDate.getMonth() + offset);
    await this.renderCalendar();
  }

  // Настройка обработчиков событий
  setupEventListeners() {
    document.getElementById("prevMonth")?.addEventListener("click", () => {
      this.navigateMonth(-1);
    });

    document.getElementById("nextMonth")?.addEventListener("click", () => {
      this.navigateMonth(1);
    });

    document.getElementById("authButton")?.addEventListener("click", () => {
      const params = new URLSearchParams({
        client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
        redirect_uri:
          "https://alerom2006.github.io/Calendar/oauth_callback.html",
        state: this.widgetInstanceId,
      });
      window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${params}`;
    });
  }

  // Переключение секции авторизации
  toggleAuthSection() {
    const authSection = document.getElementById("auth-section");
    if (authSection) {
      authSection.style.display = this.accessToken ? "none" : "block";
    }
  }

  // Показать/скрыть индикатор загрузки
  showLoading(show) {
    // Очищаем предыдущий таймаут
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }

    this.isLoading = show;
    const loader = document.getElementById("loader");
    if (loader) {
      loader.style.display = show ? "block" : "none";
    }

    // Устанавливаем таймаут для предотвращения бесконечной загрузки
    if (show) {
      this.loadingTimeout = setTimeout(() => {
        if (this.isLoading) {
          this.showLoading(false);
          this.showError(this.getTranslation("errors.timeout"));
        }
      }, 30000); // 30 секунд таймаут
    }
  }

  // Показать ошибку
  showError(message) {
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
    console.error(message);
  }

  // Предупреждение для автономного режима
  showStandaloneWarning() {
    console.warn("Виджет работает без интеграции с amoCRM");
    const warning = document.createElement("div");
    warning.className = "alert alert-warning";
    warning.textContent =
      this.lang === "ru"
        ? "Виджет работает в автономном режиме (без интеграции с amoCRM)"
        : "Widget is running in standalone mode (without amoCRM integration)";
    document.body.prepend(warning);
  }
}

// Инициализация виджета
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (window.AmoCRM) {
      window.AmoCRM.onReady(() => {
        new OrdersCalendar();
      }).catch((error) => {
        console.error("Ошибка готовности amoCRM:", error);
        new OrdersCalendar(); // Пробуем запустить в автономном режиме
      });
    } else {
      console.warn("API amoCRM не загружено, работаем в автономном режиме");
      new OrdersCalendar();
    }
  } catch (error) {
    console.error("Ошибка инициализации виджета:", error);
    const errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = "Ошибка загрузки виджета";
      errorElement.classList.remove("d-none");
    }
  }
});

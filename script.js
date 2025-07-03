// Основной класс виджета Календарь заказов
class OrdersCalendarWidget {
  constructor(params = {}) {
    // Конфигурация виджета
    this.config = {
      debugMode: true,
      version: "1.0.5",
    };

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      isLoading: false,
      context: this.detectContext(params),
      entityType: params?.entity_type || "leads",
      accountDomain: this.extractAccountDomain(params),
      widgetParams: params,
      location: params?.location || "standalone",
      settings: params?.settings || {},
    };

    // ID полей (могут быть переопределены в настройках)
    this.fieldIds = {
      ORDER_DATE: this.state.settings?.deal_date_field_id || 885453,
      DELIVERY_RANGE: this.state.settings?.delivery_range_field || 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    // Локализация
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
        settingsSave: "Ошибка при сохранении настроек",
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
        today: "Сегодня",
        openCalendar: "Открыть календарь",
        save: "Сохранить",
        settingsTitle: "Настройки календаря заказов",
      },
    };

    // Элементы DOM
    this.container = document.getElementById("widget-root");
    if (!this.container) {
      console.error("Контейнер виджета не найден");
      return;
    }

    // Инициализация
    this.initialize();
  }

  // Определение контекста работы виджета
  detectContext(params) {
    if (typeof AmoProxySDK !== "undefined") return "proxy_sdk";
    if (typeof AmoSDK !== "undefined" && params?.entity_type) return "card_sdk";
    if (typeof AmoCRM !== "undefined") return "widget";
    if (window.location.pathname.includes("settings")) return "settings";
    return "standalone";
  }

  // Получение домена аккаунта
  extractAccountDomain(params) {
    if (typeof AmoCRM !== "undefined" && AmoCRM.widgets.system?.account) {
      return AmoCRM.widgets.system.account;
    }
    if (params?.account) {
      return params.account;
    }
    return window.location.hostname.split(".")[0] || "";
  }

  // Основная инициализация
  initialize() {
    try {
      switch (this.state.location) {
        case "lcard-1":
        case "ccard-0":
          this.initCardMode();
          break;
        case "llist-0":
        case "clist-0":
          this.initListMode();
          break;
        case "settings":
          this.initSettingsMode();
          break;
        case "card_sdk":
          this.initSDKMode();
          break;
        default:
          this.initStandaloneMode();
      }
    } catch (error) {
      console.error("Ошибка инициализации виджета:", error);
      this.showFatalError();
    }
  }

  // Режим для карточки (компактный вид)
  initCardMode() {
    this.container.innerHTML = `
      <div class="compact-view">
        <h3 class="widget-title">Календарь заказов</h3>
        <div class="mini-calendar"></div>
        <button id="showFullCalendar" class="btn btn-sm btn-primary mt-2">
          ${this.i18n.labels.openCalendar}
        </button>
      </div>
    `;

    document
      .getElementById("showFullCalendar")
      ?.addEventListener("click", () => this.showFullView());
    this.renderMiniCalendar();
  }

  // Режим для списка
  initListMode() {
    this.container.innerHTML = `
      <div class="list-view">
        <h3 class="widget-title">Календарь заказов</h3>
        <div class="calendar-summary"></div>
      </div>
    `;
    this.renderSummary();
  }

  // Режим настроек
  initSettingsMode() {
    this.container.innerHTML = `
      <div class="settings-form">
        <h2>${this.i18n.labels.settingsTitle}</h2>
        <div class="mb-3">
          <label class="form-label">ID поля даты заказа:</label>
          <input type="number" class="form-control" id="dealDateField" 
                 value="${this.fieldIds.ORDER_DATE}">
        </div>
        <div class="mb-3">
          <label class="form-label">ID поля диапазона доставки:</label>
          <input type="number" class="form-control" id="deliveryRangeField" 
                 value="${this.fieldIds.DELIVERY_RANGE}">
        </div>
        <button id="saveSettings" class="btn btn-primary">
          ${this.i18n.labels.save}
        </button>
      </div>
    `;

    document
      .getElementById("saveSettings")
      ?.addEventListener("click", () => this.saveSettings());
  }

  // Режим SDK
  initSDKMode() {
    this.container.innerHTML = `
      <div class="sdk-view">
        <h3>Календарь заказов</h3>
        <div class="sdk-calendar"></div>
      </div>
    `;
    this.renderSDKCalendar();
  }

  // Автономный режим
  initStandaloneMode() {
    this.container.innerHTML = `
      <div class="standalone-view">
        <h2>Календарь заказов</h2>
        <div class="auth-section">
          <p>${this.i18n.errors.noAuth}</p>
          <button id="authButton" class="btn btn-primary">
            <span class="me-2">🔒</span>
            ${this.i18n.labels.authButton}
          </button>
        </div>
      </div>
    `;

    document.getElementById("authButton")?.addEventListener("click", () => {
      window.open(
        `https://${this.state.accountDomain}.amocrm.ru/oauth2/authorize`,
        "_blank"
      );
    });
  }

  // Полноэкранный режим календаря
  showFullView() {
    this.container.innerHTML = `
      <div class="full-calendar-view">
        <header class="widget-header mb-4">
          <h1 class="text-center mb-0">Календарь заказов</h1>
        </header>
        
        <div class="calendar-controls d-flex justify-content-between mb-3">
          <button id="prevMonth" class="btn btn-outline-primary">
            &lt; Предыдущий
          </button>
          <h2 id="currentMonthYear" class="text-center mb-0 fs-4"></h2>
          <button id="nextMonth" class="btn btn-outline-primary">
            Следующий &gt;
          </button>
        </div>
        
        <div id="calendar" class="calendar-grid mb-4"></div>
        
        <div class="deal-list-section">
          <h3 class="mb-3">
            <span>${this.i18n.labels.dealsFor}</span>
            <span id="selectedDate">${this.i18n.labels.selectDate}</span>
          </h3>
          <div id="deals" class="deals-container"></div>
        </div>
      </div>
    `;

    this.bindCalendarEvents();
    this.loadData().then(() => this.renderCalendar());
  }

  // Загрузка данных о сделках
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

      // Загрузка в зависимости от контекста
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
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      this.showError(this.i18n.errors.load);
      return [];
    } finally {
      this.state.isLoading = false;
      this.hideLoader();
    }
  }

  // Обработка данных о сделках
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

        if (!this.state.dealsData[dateStr]) {
          this.state.dealsData[dateStr] = [];
        }

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

  // Получение значения кастомного поля
  getCustomFieldValue(deal, fieldId) {
    const field = deal.custom_fields_values?.find(
      (f) => f.field_id === fieldId
    );
    return field?.values?.[0]?.value || null;
  }

  // Отрисовка календаря
  renderCalendar() {
    const month = this.state.currentDate.getMonth();
    const year = this.state.currentDate.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    // Обновление заголовка
    const monthTitle = document.getElementById("currentMonthYear");
    if (monthTitle) {
      monthTitle.textContent = `${this.i18n.months[month]} ${year}`;
    }

    // Генерация сетки календаря
    let calendarHTML = "";

    // Дни недели
    this.i18n.weekdays.forEach(
      (day) => (calendarHTML += `<div class="weekday">${day}</div>`)
    );

    // Пустые ячейки в начале месяца
    for (let i = 0; i < startDay; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>';
    }

    // Дни месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealsCount = this.state.dealsData[dateStr]?.length || 0;
      const isToday = this.isToday(dateStr);

      const dayClass = [
        "calendar-day",
        isToday ? "today" : "",
        dealsCount > 0 ? "has-deals" : "",
      ]
        .filter(Boolean)
        .join(" ");

      calendarHTML += `
        <div class="${dayClass}" data-date="${dateStr}">
          ${day}
          ${
            dealsCount > 0
              ? `<span class="deal-count">${dealsCount}</span>`
              : ""
          }
        </div>
      `;
    }

    // Вставка в DOM
    const calendarGrid = document.getElementById("calendar");
    if (calendarGrid) {
      calendarGrid.innerHTML = calendarHTML;

      // Назначение обработчиков событий
      const days = calendarGrid.querySelectorAll(".calendar-day:not(.empty)");
      days.forEach((day) => {
        day.addEventListener("click", () =>
          this.showDealsForDate(day.dataset.date)
        );
      });
    }

    // Показать сделки для выбранной даты (если есть)
    if (this.state.selectedDate) {
      this.showDealsForDate(this.state.selectedDate);
    }
  }

  // Проверка, является ли дата сегодняшней
  isToday(dateStr) {
    const today = new Date();
    const checkDate = new Date(dateStr);
    return (
      checkDate.getDate() === today.getDate() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear()
    );
  }

  // Показать сделки для конкретной даты
  showDealsForDate(date) {
    this.state.selectedDate = date;
    const dateElement = document.getElementById("selectedDate");

    if (dateElement) {
      const dateObj = new Date(date);
      dateElement.textContent = dateObj.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    const deals = this.state.dealsData[date] || [];
    const dealsContainer = document.getElementById("deals");

    if (!dealsContainer) return;

    if (deals.length === 0) {
      dealsContainer.innerHTML = `<div class="no-deals">${this.i18n.errors.noDeals}</div>`;
      return;
    }

    // Сортировка сделок по ID (новые сверху)
    deals.sort((a, b) => b.id - a.id);

    // Генерация HTML для списка сделок
    dealsContainer.innerHTML = deals
      .map(
        (deal) => `
      <div class="deal-item" data-deal-id="${deal.id}">
        <div class="deal-header">
          <span class="deal-id">#${deal.id}</span>
          <span class="deal-status">${this.getStatusName(deal.status_id)}</span>
        </div>
        <div class="deal-name">${deal.name}</div>
        <div class="deal-price">${deal.price ? `${deal.price} руб.` : "—"}</div>
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
    `
      )
      .join("");

    // Назначение обработчиков для открытия карточки сделки
    document.querySelectorAll(".deal-item").forEach((deal) => {
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      });
    });
  }

  // Получение названия статуса по ID
  getStatusName(statusId) {
    const statuses = {
      142: "Новая",
      143: "В работе",
      144: "Завершена",
      145: "Отменена",
    };
    return statuses[statusId] || `Статус #${statusId}`;
  }

  // Открытие карточки сделки
  openDealCard(dealId) {
    if (!dealId) return;

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

  // Переключение на предыдущий месяц
  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.loadData().then(() => this.renderCalendar());
  }

  // Переключение на следующий месяц
  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.loadData().then(() => this.renderCalendar());
  }

  // Привязка событий календаря
  bindCalendarEvents() {
    document
      .getElementById("prevMonth")
      ?.addEventListener("click", () => this.prevMonth());
    document
      .getElementById("nextMonth")
      ?.addEventListener("click", () => this.nextMonth());
  }

  // Сохранение настроек
  saveSettings() {
    const newSettings = {
      deal_date_field_id:
        parseInt(document.getElementById("dealDateField")?.value) ||
        this.fieldIds.ORDER_DATE,
      delivery_range_field:
        parseInt(document.getElementById("deliveryRangeField")?.value) ||
        this.fieldIds.DELIVERY_RANGE,
    };

    try {
      if (this.state.context === "proxy_sdk") {
        AmoProxySDK.saveSettings(newSettings)
          .then(() => this.showMessage("Настройки сохранены!"))
          .catch(() => this.showError(this.i18n.errors.settingsSave));
      } else if (typeof AmoSDK !== "undefined") {
        AmoSDK.saveSettings(newSettings)
          .then(() => this.showMessage("Настройки сохранены!"))
          .catch(() => this.showError(this.i18n.errors.settingsSave));
      } else if (typeof AmoCRM !== "undefined") {
        AmoCRM.widgets
          .system()
          .then((system) => system.saveSettings(newSettings))
          .then(() => this.showMessage("Настройки сохранены!"))
          .catch(() => this.showError(this.i18n.errors.settingsSave));
      }
    } catch (error) {
      console.error("Ошибка сохранения настроек:", error);
      this.showError(this.i18n.errors.settingsSave);
    }
  }

  // Показать лоадер
  showLoader() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "block";
  }

  // Скрыть лоадер
  hideLoader() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "none";
  }

  // Показать сообщение об ошибке
  showError(message) {
    const errorEl =
      document.getElementById("error-alert") || document.createElement("div");
    errorEl.className = "alert alert-danger";
    errorEl.textContent = message;

    if (!document.getElementById("error-alert")) {
      errorEl.id = "error-alert";
      this.container.prepend(errorEl);
    }

    setTimeout(() => {
      errorEl.classList.add("fade-out");
      setTimeout(() => errorEl.remove(), 500);
    }, 5000);
  }

  // Показать информационное сообщение
  showMessage(message) {
    const alertEl = document.createElement("div");
    alertEl.className = "alert alert-success position-fixed top-0 end-0 m-3";
    alertEl.textContent = message;
    document.body.appendChild(alertEl);

    setTimeout(() => {
      alertEl.classList.add("fade-out");
      setTimeout(() => alertEl.remove(), 500);
    }, 3000);
  }

  // Показать критическую ошибку
  showFatalError() {
    this.container.innerHTML = `
      <div class="alert alert-danger">
        Произошла критическая ошибка при загрузке виджета. Пожалуйста, обновите страницу.
      </div>
    `;
  }

  // Очистка при уничтожении виджета
  destroy() {
    // Удаление всех обработчиков событий
    document.getElementById("prevMonth")?.removeEventListener("click");
    document.getElementById("nextMonth")?.removeEventListener("click");
    document.getElementById("showFullCalendar")?.removeEventListener("click");
    document.getElementById("authButton")?.removeEventListener("click");
    document.getElementById("saveSettings")?.removeEventListener("click");
  }
}

// Инициализация виджета в зависимости от контекста
if (typeof AmoWidget === "function") {
  // Режим amoCRM
  AmoWidget({
    init: function (system) {
      this.system = system;
      this.params = system.params || {};
      this.widget = new OrdersCalendarWidget({
        ...this.params,
        location: system.location,
      });
    },

    render: function () {
      return this.widget.render();
    },

    bind_actions: function () {
      this.widget.bindEvents();
    },

    onSave: function () {
      return this.widget.saveSettings();
    },

    destroy: function () {
      this.widget.destroy();
    },

    onLoad: function () {
      // Дополнительные действия при загрузке
    },
  });
} else {
  // Автономный режим
  document.addEventListener("DOMContentLoaded", function () {
    new OrdersCalendarWidget();
  });
}

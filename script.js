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
      accountDomain: this.extractAccountDomain(),
    };

    // ID полей из amoCRM
    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
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
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
        authButton: "Авторизоваться в amoCRM",
      },
    };

    // Инициализация
    this.initialize();
  }

  // Определение контекста запуска
  detectContext(params) {
    if (typeof AmoSDK !== "undefined" && params?.entity_type) {
      return "card_sdk";
    }
    if (typeof AmoCRM !== "undefined") {
      return "widget";
    }
    if (window.location.pathname.includes("settings")) {
      return "settings";
    }
    return "standalone";
  }

  // Извлечение домена аккаунта
  extractAccountDomain() {
    if (typeof AmoCRM !== "undefined") {
      return AmoCRM.widgets.system?.account || "";
    }
    return window.location.hostname.split(".")[0] || "";
  }

  // Основная инициализация
  initialize() {
    try {
      switch (this.state.context) {
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
      console.error("Ошибка инициализации:", error);
      this.showFatalError();
    }
  }

  // Режим работы в карточке через SDK
  initCardSDKMode() {
    this.initUI();
    this.loadData()
      .then(() => this.renderCalendar())
      .catch((error) => {
        console.error("Ошибка загрузки данных:", error);
        this.showError(this.i18n.errors.load);
      });
  }

  // Режим стандартного виджета
  initWidgetMode() {
    AmoCRM.widgets.system().then((system) => {
      this.applySettings(system.settings);
      this.initUI();
      this.loadData()
        .then(() => this.renderCalendar())
        .catch((error) => {
          console.error("Ошибка загрузки данных:", error);
          this.showError(this.i18n.errors.load);
        });
    });
  }

  // Режим настроек
  initSettingsMode() {
    document.body.innerHTML = `
      <div class="settings-container">
        <h2>Настройки календаря заказов</h2>
        <div class="form-group">
          <label>ID поля даты заказа:</label>
          <input type="number" id="dealDateField" value="${this.fieldIds.ORDER_DATE}">
        </div>
        <button id="saveSettings">Сохранить</button>
      </div>
    `;

    document.getElementById("saveSettings").addEventListener("click", () => {
      this.saveSettings();
    });
  }

  // Автономный режим
  initStandaloneMode() {
    this.showAuthScreen();
  }

  // Применение настроек
  applySettings(settings) {
    if (settings?.deal_date_field_id) {
      this.fieldIds.ORDER_DATE =
        parseInt(settings.deal_date_field_id) || this.fieldIds.ORDER_DATE;
    }
    if (settings?.delivery_range_field) {
      this.fieldIds.DELIVERY_RANGE =
        parseInt(settings.delivery_range_field) || this.fieldIds.DELIVERY_RANGE;
    }
  }

  // Сохранение настроек
  saveSettings() {
    const newSettings = {
      deal_date_field_id:
        parseInt(document.getElementById("dealDateField").value) ||
        this.fieldIds.ORDER_DATE,
    };

    if (typeof AmoSDK !== "undefined") {
      AmoSDK.saveSettings(newSettings)
        .then(() => this.showMessage("Настройки сохранены!"))
        .catch((error) => {
          console.error("Ошибка сохранения:", error);
          this.showError("Ошибка сохранения настроек");
        });
    }
  }

  // Инициализация интерфейса
  initUI() {
    this.container = document.createElement("div");
    this.container.className = `orders-calendar ${this.state.context}`;
    this.container.innerHTML = `
      <div class="widget-header">
        <h2>Календарь заказов</h2>
      </div>
      <div class="widget-loading">Загрузка...</div>
      <div class="error-message"></div>
      <div class="calendar-container">
        <div class="calendar-header">
          <button class="nav-button prev-month">&lt;</button>
          <h3 class="current-month"></h3>
          <button class="nav-button next-month">&gt;</button>
        </div>
        <div class="calendar-grid"></div>
      </div>
      <div class="deals-container">
        <h4 class="deals-title">${this.i18n.labels.dealsFor} <span class="selected-date">${this.i18n.labels.selectDate}</span></h4>
        <div class="deals-list"></div>
      </div>
    `;

    document.body.appendChild(this.container);
    this.bindEvents();
  }

  // Привязка событий
  bindEvents() {
    this.container
      .querySelector(".prev-month")
      .addEventListener("click", () => this.prevMonth());
    this.container
      .querySelector(".next-month")
      .addEventListener("click", () => this.nextMonth());
  }

  // Загрузка данных
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

      if (this.state.context === "card_sdk" && typeof AmoSDK !== "undefined") {
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
        deals = response._embedded.leads;
      }

      this.processDealsData(deals);
      return deals;
    } finally {
      this.state.isLoading = false;
      this.hideLoader();
    }
  }

  // Обработка данных сделок
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

    // Обновляем заголовок
    this.container.querySelector(
      ".current-month"
    ).textContent = `${this.i18n.months[month]} ${year}`;

    let calendarHTML = "";

    // Дни недели
    this.i18n.weekdays.forEach((day) => {
      calendarHTML += `<div class="weekday">${day}</div>`;
    });

    // Пустые ячейки в начале месяца
    for (let i = 0; i < startDay; i++) {
      calendarHTML += '<div class="day empty"></div>';
    }

    // Дни месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const dealsCount = this.state.dealsData[dateStr]?.length || 0;

      calendarHTML += `
        <div class="day" data-date="${dateStr}">
          ${day}
          ${
            dealsCount > 0
              ? `<span class="deal-count">${dealsCount}</span>`
              : ""
          }
        </div>
      `;
    }

    this.container.querySelector(".calendar-grid").innerHTML = calendarHTML;

    // Назначение обработчиков для дней
    this.container.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () =>
        this.showDealsForDate(day.dataset.date)
      );
    });
  }

  // Показать сделки на выбранную дату
  showDealsForDate(date) {
    this.state.selectedDate = date;
    this.container.querySelector(".selected-date").textContent = date;

    const deals = this.state.dealsData[date] || [];
    let dealsHTML = "";

    if (deals.length === 0) {
      dealsHTML = `<div class="no-deals">${this.i18n.errors.noDeals}</div>`;
    } else {
      // Сортируем по ID (новые сверху)
      deals
        .sort((a, b) => b.id - a.id)
        .forEach((deal) => {
          dealsHTML += `
          <div class="deal-item" data-deal-id="${deal.id}">
            <div class="deal-id">ID: ${deal.id}</div>
            <div class="deal-name">${deal.name}</div>
            <div class="deal-price">${deal.price || "—"} руб.</div>
            <div class="deal-field">Доставка: ${
              deal.custom_fields[this.fieldIds.DELIVERY_RANGE] || "—"
            }</div>
            <div class="deal-field">Точное время: ${
              deal.custom_fields[this.fieldIds.EXACT_TIME] ? "Да" : "Нет"
            }</div>
            <div class="deal-field">Адрес: ${
              deal.custom_fields[this.fieldIds.ADDRESS] || "—"
            }</div>
          </div>
        `;
        });
    }

    this.container.querySelector(".deals-list").innerHTML = dealsHTML;

    // Назначение обработчиков для сделок
    this.container.querySelectorAll(".deal-item").forEach((deal) => {
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      });
    });
  }

  // Открыть карточку сделки
  openDealCard(dealId) {
    if (this.state.context === "card_sdk" && typeof AmoSDK !== "undefined") {
      AmoSDK.openCard(parseInt(dealId));
    } else if (typeof AmoCRM !== "undefined") {
      AmoCRM.widgets.system().then((system) => {
        system.openCard(parseInt(dealId));
      });
    } else {
      window.open(
        `https://${this.state.accountDomain}.amocrm.ru/leads/detail/${dealId}`,
        "_blank"
      );
    }
  }

  // Переключение месяцев
  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.loadData().then(() => this.renderCalendar());
  }

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.loadData().then(() => this.renderCalendar());
  }

  // Показ экрана авторизации
  showAuthScreen() {
    document.body.innerHTML = `
      <div class="auth-container">
        <h2>Календарь заказов</h2>
        <p>${this.i18n.errors.noAuth}</p>
        <button id="authButton" class="auth-button">
          ${this.i18n.labels.authButton}
        </button>
      </div>
    `;

    document.getElementById("authButton").addEventListener("click", () => {
      window.open(
        `https://${this.state.accountDomain}.amocrm.ru/oauth2/authorize`,
        "_blank"
      );
    });
  }

  // Управление состоянием загрузки
  showLoader() {
    const loader = this.container?.querySelector(".widget-loading");
    if (loader) loader.style.display = "block";
  }

  hideLoader() {
    const loader = this.container?.querySelector(".widget-loading");
    if (loader) loader.style.display = "none";
  }

  // Показ ошибок
  showError(message) {
    const errorEl = this.container?.querySelector(".error-message");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
      setTimeout(() => (errorEl.style.display = "none"), 5000);
    }
  }

  // Показ сообщений
  showMessage(message) {
    alert(message); // Можно заменить на красивый toast
  }

  // Фатальная ошибка
  showFatalError() {
    document.body.innerHTML = `
      <div style="color:red;padding:20px;">
        Произошла критическая ошибка при загрузке виджета. Пожалуйста, обновите страницу.
      </div>
    `;
  }
}

// Инициализация виджета в зависимости от контекста
if (typeof AmoSDK !== "undefined") {
  // Режим SDK (карточки, списки)
  AmoSDK.init().then((params) => {
    new OrdersCalendarWidget(params);
  });
} else if (typeof AmoCRM !== "undefined") {
  // Стандартный режим виджета
  AmoCRM.widgets.system().then((system) => {
    new OrdersCalendarWidget(system.params);
  });
} else {
  // Автономный режим (настройки, standalone)
  new OrdersCalendarWidget();
}

class OrdersCalendarWidget {
  constructor() {
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
      container: null,
      isInAmoContext: false,
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
        authButton: "Авторизоваться в amoCRM",
        loading: "Загрузка...",
      },
    };

    // Проверяем контекст выполнения
    this.checkEnvironment();
  }

  // Проверка окружения
  checkEnvironment() {
    this.state.isInAmoContext = this.isInAmoCRM();

    if (!this.state.isInAmoContext) {
      this.showAuthScreen();
      return;
    }

    this.init();
  }

  // Проверка что виджет запущен в amoCRM
  isInAmoCRM() {
    try {
      // 1. Проверка через window.self и window.top
      if (window.self !== window.top) {
        return true;
      }

      // 2. Проверка по URL
      if (window.location.href.includes("amocrm.ru")) {
        return true;
      }

      // 3. Проверка по referrer
      if (document.referrer.includes("amocrm.ru")) {
        return true;
      }

      return false;
    } catch (e) {
      console.error("Ошибка проверки контекста:", e);
      return false;
    }
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
      this.handleAuthClick();
    });
  }

  // Обработка клика по кнопке авторизации
  handleAuthClick() {
    // Ваш OAuth URL (замените на реальные параметры)
    const authUrl = `https://www.amocrm.ru/oauth?client_id=YOUR_CLIENT_ID&state=calendar_widget&mode=popup`;
    window.open(authUrl, "_blank");
  }

  // Основная инициализация виджета
  async init() {
    try {
      this.initUI();
      await this.loadSettings();
      await this.loadDealsData();
      this.renderCalendar();
    } catch (error) {
      console.error("Ошибка инициализации:", error);
      this.showError(this.i18n.errors.load);
    } finally {
      this.hideLoader();
    }
  }

  // Инициализация интерфейса
  initUI() {
    this.state.container = document.createElement("div");
    this.state.container.className = "orders-calendar-container";
    this.state.container.innerHTML = `
      <div class="widget-loading">${this.i18n.labels.loading}</div>
      <div class="error-message"></div>
      <div class="calendar-header">
        <button class="nav-button prev-month">&lt;</button>
        <h2 class="current-month"></h2>
        <button class="nav-button next-month">&gt;</button>
      </div>
      <div class="calendar-grid"></div>
      <div class="deals-list-container">
        <h3>Сделки на <span class="selected-date">${this.i18n.labels.selectDate}</span></h3>
        <div class="deals-list"></div>
      </div>
    `;

    document.body.appendChild(this.state.container);

    // Назначение обработчиков
    this.bindEvents();
  }

  // Назначение обработчиков событий
  bindEvents() {
    this.state.container
      .querySelector(".prev-month")
      .addEventListener("click", () => this.prevMonth());
    this.state.container
      .querySelector(".next-month")
      .addEventListener("click", () => this.nextMonth());
  }

  // Загрузка данных о сделках
  async loadDealsData() {
    if (this.state.isLoading) return;

    this.state.isLoading = true;
    this.showLoader();

    try {
      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      // Используем postMessage для запроса данных
      const requestId = Date.now();

      window.parent.postMessage(
        {
          type: "getLeadsRequest",
          requestId,
          filter: {
            [this.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        },
        "*"
      );

      // Ждем ответа
      const deals = await this.waitForResponse(requestId);
      this.processDealsData(deals);
    } catch (error) {
      console.error("Ошибка загрузки сделок:", error);
      throw error;
    } finally {
      this.state.isLoading = false;
      this.hideLoader();
    }
  }

  // Ожидание ответа от родительского окна
  waitForResponse(requestId) {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (
          event.data.type === "getLeadsResponse" &&
          event.data.requestId === requestId
        ) {
          window.removeEventListener("message", handler);
          resolve(event.data.leads);
        }
      };

      window.addEventListener("message", handler);
    });
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
    this.state.container.querySelector(
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

    this.state.container.querySelector(".calendar-grid").innerHTML =
      calendarHTML;

    // Назначение обработчиков для дней
    this.state.container.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () =>
        this.showDealsForDate(day.dataset.date)
      );
    });
  }

  // Показать сделки на выбранную дату
  showDealsForDate(date) {
    this.state.selectedDate = date;
    this.state.container.querySelector(".selected-date").textContent = date;

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
            <div class="deal-name">Название: ${deal.name}</div>
            <div class="deal-price">Бюджет: ${deal.price || "—"} руб.</div>
            <div class="deal-field">Диапазон доставки: ${
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

    this.state.container.querySelector(".deals-list").innerHTML = dealsHTML;

    // Назначение обработчиков для сделок
    this.state.container.querySelectorAll(".deal-item").forEach((deal) => {
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      });
    });
  }

  // Открыть карточку сделки
  openDealCard(dealId) {
    if (this.state.isInAmoContext) {
      window.parent.postMessage(
        {
          type: "openCard",
          dealId: parseInt(dealId),
        },
        "*"
      );
    } else {
      console.warn("Открытие карточки доступно только в контексте amoCRM");
    }
  }

  // Переключение месяцев
  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.loadDealsData().then(() => this.renderCalendar());
  }

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.loadDealsData().then(() => this.renderCalendar());
  }

  // Показ ошибок
  showError(message) {
    const errorEl = this.state.container.querySelector(".error-message");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
      setTimeout(() => (errorEl.style.display = "none"), 5000);
    }
  }

  // Управление состоянием загрузки
  showLoader() {
    const loader = this.state.container.querySelector(".widget-loading");
    if (loader) loader.style.display = "block";
  }

  hideLoader() {
    const loader = this.state.container.querySelector(".widget-loading");
    if (loader) loader.style.display = "none";
  }
}

// Инициализация виджета
document.addEventListener("DOMContentLoaded", () => {
  try {
    new OrdersCalendarWidget();
  } catch (error) {
    console.error("Фатальная ошибка:", error);
    document.body.innerHTML = `
      <div style="color:red;padding:20px;">
        Произошла критическая ошибка при загрузке виджета
      </div>
    `;
  }
});

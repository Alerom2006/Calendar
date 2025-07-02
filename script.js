// Основной класс виджета календаря заказов
class OrdersCalendarWidget {
  constructor() {
    // Конфигурация виджета
    this.config = {
      debugMode: true,
      version: "1.0.4",
    };

    // Состояние виджета
    this.state = {
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
      isLoading: false,
    };

    // ID полей из amoCRM (можно переопределять в настройках)
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
      },
    };

    // Инициализация
    this.init();
  }

  // Инициализация виджета
  async init() {
    try {
      this.showLoader();

      // Проверяем контекст выполнения
      if (!this.isInAmoCRM()) {
        this.showError("Виджет должен работать внутри amoCRM");
        return;
      }

      // Загружаем настройки
      await this.loadSettings();

      // Инициализируем интерфейс
      this.initUI();

      // Загружаем данные
      await this.loadDealsData();

      // Рендерим календарь
      this.renderCalendar();
    } catch (error) {
      console.error("Ошибка инициализации:", error);
      this.showError(this.i18n.errors.load);
    } finally {
      this.hideLoader();
    }
  }

  // Проверка что виджет запущен в amoCRM
  isInAmoCRM() {
    return (
      typeof AmoCRM !== "undefined" ||
      typeof AmoSDK !== "undefined" ||
      window.location.hostname.includes("amocrm")
    );
  }

  // Загрузка настроек
  async loadSettings() {
    return new Promise((resolve) => {
      if (typeof AmoCRM !== "undefined" && AmoCRM.widgets?.system) {
        AmoCRM.widgets
          .system()
          .then((system) => {
            if (system.settings) {
              this.fieldIds.ORDER_DATE =
                system.settings.deal_date_field_id || this.fieldIds.ORDER_DATE;
              this.fieldIds.DELIVERY_RANGE =
                system.settings.delivery_range_field ||
                this.fieldIds.DELIVERY_RANGE;
            }
            resolve();
          })
          .catch(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // Инициализация интерфейса
  initUI() {
    const container = document.createElement("div");
    container.className = "orders-calendar-widget";
    container.innerHTML = `
      <div class="calendar-header">
        <button class="nav-button prev-month">&lt;</button>
        <h2 class="current-month"></h2>
        <button class="nav-button next-month">&gt;</button>
      </div>
      <div class="calendar-grid"></div>
      <div class="deals-list-container">
        <h3 class="deals-title">Сделки на <span class="selected-date"></span></h3>
        <div class="deals-list"></div>
      </div>
      <div class="loader"></div>
      <div class="error-message"></div>
    `;
    document.body.appendChild(container);

    // Назначение обработчиков событий
    document
      .querySelector(".prev-month")
      .addEventListener("click", () => this.prevMonth());
    document
      .querySelector(".next-month")
      .addEventListener("click", () => this.nextMonth());
  }

  // Загрузка данных о сделках
  async loadDealsData() {
    if (this.state.isLoading) return;
    this.state.isLoading = true;

    try {
      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      let deals = [];

      // Получаем сделки через доступные API
      if (typeof AmoCRM !== "undefined") {
        const response = await AmoCRM.request("/api/v4/leads", {
          filter: {
            [this.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        });
        deals = response._embedded.leads;
      } else if (typeof AmoSDK !== "undefined") {
        deals = await AmoSDK.getLeads({
          filter: {
            [this.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
        });
      }

      this.processDealsData(deals);
    } catch (error) {
      console.error("Ошибка загрузки сделок:", error);
      throw error;
    } finally {
      this.state.isLoading = false;
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
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Коррекция для Пн-Вс

    // Обновляем заголовок
    document.querySelector(
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

    document.querySelector(".calendar-grid").innerHTML = calendarHTML;

    // Назначение обработчиков для дней
    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () =>
        this.showDealsForDate(day.dataset.date)
      );
    });
  }

  // Показать сделки на выбранную дату
  showDealsForDate(date) {
    this.state.selectedDate = date;
    document.querySelector(".selected-date").textContent = date;

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

    document.querySelector(".deals-list").innerHTML = dealsHTML;

    // Назначение обработчиков для сделок
    document.querySelectorAll(".deal-item").forEach((deal) => {
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      });
    });
  }

  // Открыть карточку сделки
  openDealCard(dealId) {
    if (typeof AmoCRM !== "undefined" && AmoCRM.widgets?.system) {
      AmoCRM.widgets.system().then((system) => {
        if (system.openCard) {
          system.openCard(parseInt(dealId));
        }
      });
    } else if (typeof AmoSDK !== "undefined" && AmoSDK.openCard) {
      AmoSDK.openCard(parseInt(dealId));
    } else {
      window.open(`/leads/detail/${dealId}`, "_blank");
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

  // Управление состоянием загрузки
  showLoader() {
    document.body.classList.add("widget-loading");
  }

  hideLoader() {
    document.body.classList.remove("widget-loading");
  }

  // Показать сообщение об ошибке
  showError(message) {
    const errorEl = document.querySelector(".error-message");
    errorEl.textContent = message;
    errorEl.style.display = "block";
    setTimeout(() => (errorEl.style.display = "none"), 5000);
  }
}

// Инициализация виджета при загрузке
document.addEventListener("DOMContentLoaded", () => {
  new OrdersCalendarWidget();
});

// Для отладки в консоли
if (typeof window !== "undefined") {
  window.OrdersCalendarWidget = OrdersCalendarWidget;
}

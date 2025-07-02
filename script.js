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
      container: null, // Храним ссылку на DOM-контейнер
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
      },
      labels: {
        dealsFor: "Сделки на",
        selectDate: "выберите дату",
      },
    };

    // Инициализация
    this.init();
  }

  // Инициализация виджета
  async init() {
    try {
      // Сначала создаем DOM-структуру
      this.initUI();

      // Проверяем контекст выполнения
      if (!this.isInAmoCRM()) {
        this.showError("Виджет должен работать внутри amoCRM");
        return;
      }

      // Затем загружаем данные
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

  // Инициализация интерфейса (исправленная версия)
  initUI() {
    // Создаем основной контейнер
    this.state.container = document.createElement("div");
    this.state.container.className = "orders-calendar-widget";

    // Добавляем всю структуру
    this.state.container.innerHTML = `
      <div class="widget-loading" style="display:none">Загрузка...</div>
      <div class="error-message" style="display:none; color:red; padding:10px;"></div>
      <div class="calendar-header">
        <button class="nav-button prev-month">&lt;</button>
        <h2 class="current-month"></h2>
        <button class="nav-button next-month">&gt;</button>
      </div>
      <div class="calendar-grid"></div>
      <div class="deals-list-container">
        <h3 class="deals-title">${this.i18n.labels.dealsFor} <span class="selected-date">${this.i18n.labels.selectDate}</span></h3>
        <div class="deals-list"></div>
      </div>
    `;

    document.body.appendChild(this.state.container);

    // Назначение обработчиков событий
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
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Коррекция для Пн-Вс

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

  // Показ ошибок (исправленная версия)
  showError(message) {
    const errorEl = this.state.container.querySelector(".error-message");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = "block";
      setTimeout(() => (errorEl.style.display = "none"), 5000);
    } else {
      console.error("Элемент для ошибки не найден:", message);
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

// Инициализация виджета после загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
  try {
    new OrdersCalendarWidget();
  } catch (error) {
    console.error("Ошибка при создании виджета:", error);
    // Fallback сообщение
    const errorDiv = document.createElement("div");
    errorDiv.style.color = "red";
    errorDiv.style.padding = "10px";
    errorDiv.textContent = "Ошибка загрузки виджета календаря";
    document.body.appendChild(errorDiv);
  }
});

// Для отладки в консоли
if (typeof window !== "undefined") {
  window.OrdersCalendarWidget = OrdersCalendarWidget;
}

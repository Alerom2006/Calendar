// Проверяем загружен ли AmoCRM SDK
if (typeof AmoSDK === "undefined") {
  console.error("AmoCRM SDK не загружен");
} else {
  console.log("AmoCRM SDK доступен");
}

// Основной класс виджета
class OrdersCalendar {
  constructor() {
    this.config = {
      debugMode: true,
      widgetVersion: "1.0.4",
    };

    this.state = {
      currentDate: new Date(),
      dealsData: {},
      selectedDate: null,
    };

    this.fieldIds = {
      ORDER_DATE: 885453,
      DELIVERY_RANGE: 892009,
      EXACT_TIME: 892003,
      ADDRESS: 887367,
    };

    this.init();
  }

  // Инициализация виджета
  async init() {
    try {
      // Ждем загрузки SDK
      await this.waitForSDK();

      // Проверяем контекст выполнения
      if (!AmoSDK.isCardSDK()) {
        console.error("Виджет должен запускаться в контексте карточки сделки");
        return;
      }

      // Получаем параметры интеграции
      const params = AmoSDK.getWidgetParams();
      console.log("Параметры виджета:", params);

      // Инициализируем интерфейс
      this.initUI();

      // Загружаем данные
      await this.loadData();
    } catch (error) {
      console.error("Ошибка инициализации:", error);
      this.showError("Ошибка загрузки виджета");
    }
  }

  // Ожидание загрузки SDK
  waitForSDK() {
    return new Promise((resolve) => {
      if (typeof AmoSDK !== "undefined") {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (typeof AmoSDK !== "undefined") {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      }
    });
  }

  // Инициализация интерфейса
  initUI() {
    const container = document.createElement("div");
    container.className = "orders-calendar-container";
    container.innerHTML = `
      <div class="calendar-header">
        <button class="prev-month">&lt;</button>
        <h2 class="current-month"></h2>
        <button class="next-month">&gt;</button>
      </div>
      <div class="calendar-grid"></div>
      <div class="deals-container"></div>
    `;
    document.body.appendChild(container);

    // Назначаем обработчики событий
    document
      .querySelector(".prev-month")
      .addEventListener("click", () => this.prevMonth());
    document
      .querySelector(".next-month")
      .addEventListener("click", () => this.nextMonth());
  }

  // Загрузка данных
  async loadData() {
    try {
      this.showLoader();

      const now = new Date();
      const dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const dateTo = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      // Получаем сделки через SDK
      const deals = await AmoSDK.getLeads({
        filter: {
          [this.fieldIds.ORDER_DATE]: {
            from: Math.floor(dateFrom.getTime() / 1000),
            to: Math.floor(dateTo.getTime() / 1000),
          },
        },
      });

      this.processDeals(deals);
      this.renderCalendar();
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
      this.showError("Не удалось загрузить данные");
    } finally {
      this.hideLoader();
    }
  }

  // Обработка данных сделок
  processDeals(deals) {
    this.state.dealsData = {};

    deals.forEach((deal) => {
      const dateField = deal.custom_fields_values?.find(
        (f) => f.field_id === this.fieldIds.ORDER_DATE
      );

      if (dateField?.values?.[0]?.value) {
        const date = new Date(dateField.values[0].value * 1000);
        const dateKey = date.toISOString().split("T")[0];

        if (!this.state.dealsData[dateKey]) {
          this.state.dealsData[dateKey] = [];
        }

        this.state.dealsData[dateKey].push(deal);
      }
    });
  }

  // Отрисовка календаря
  renderCalendar() {
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

    const currentMonth = this.state.currentDate.getMonth();
    const currentYear = this.state.currentDate.getFullYear();

    // Обновляем заголовок
    document.querySelector(
      ".current-month"
    ).textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Генерируем календарь
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    let calendarHTML = "";

    // Дни недели
    const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    weekdays.forEach((day) => {
      calendarHTML += `<div class="weekday">${day}</div>`;
    });

    // Пустые ячейки
    for (let i = 0; i < startDay; i++) {
      calendarHTML += '<div class="day empty"></div>';
    }

    // Дни месяца
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dateKey = date.toISOString().split("T")[0];
      const dealsCount = this.state.dealsData[dateKey]?.length || 0;

      calendarHTML += `
        <div class="day" data-date="${dateKey}">
          ${day}
          ${dealsCount > 0 ? `<span class="badge">${dealsCount}</span>` : ""}
        </div>
      `;
    }

    document.querySelector(".calendar-grid").innerHTML = calendarHTML;

    // Назначаем обработчики для дней
    document.querySelectorAll(".day:not(.empty)").forEach((day) => {
      day.addEventListener("click", () =>
        this.showDealsForDate(day.dataset.date)
      );
    });
  }

  // Показать сделки на выбранную дату
  showDealsForDate(date) {
    this.state.selectedDate = date;
    const deals = this.state.dealsData[date] || [];

    let dealsHTML = "";

    if (deals.length === 0) {
      dealsHTML = '<div class="no-deals">Нет сделок на выбранную дату</div>';
    } else {
      // Сортируем по ID (новые сверху)
      deals
        .sort((a, b) => b.id - a.id)
        .forEach((deal) => {
          dealsHTML += `
          <div class="deal" data-deal-id="${deal.id}">
            <div class="deal-id">ID: ${deal.id}</div>
            <div class="deal-name">${deal.name}</div>
            <div class="deal-price">${deal.price || "—"} руб.</div>
          </div>
        `;
        });
    }

    document.querySelector(".deals-container").innerHTML = dealsHTML;

    // Назначаем обработчики для сделок
    document.querySelectorAll(".deal").forEach((deal) => {
      deal.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openDealCard(deal.dataset.dealId);
      });
    });
  }

  // Открыть карточку сделки
  openDealCard(dealId) {
    if (AmoSDK.openCard) {
      AmoSDK.openCard(dealId);
    } else {
      console.error("Метод openCard недоступен");
    }
  }

  // Переключение месяцев
  prevMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
    this.renderCalendar();
  }

  nextMonth() {
    this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
    this.renderCalendar();
  }

  // Вспомогательные методы
  showLoader() {
    document.body.classList.add("loading");
  }

  hideLoader() {
    document.body.classList.remove("loading");
  }

  showError(message) {
    const errorEl = document.createElement("div");
    errorEl.className = "error-message";
    errorEl.textContent = message;
    document.body.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), 5000);
  }
}

// Запуск виджета при загрузке SDK
document.addEventListener("DOMContentLoaded", () => {
  if (typeof AmoSDK !== "undefined") {
    new OrdersCalendar();
  } else {
    console.error("AmoSDK не загружен");
  }
});

// Для отладки в консоли
window.OrdersCalendar = OrdersCalendar;

class OrdersCalendar {
  varructor() {
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

  detectLanguage() {
    return navigator.language.startsWith("ru") ? "ru" : "en";
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
      console.error("Ошибка инициализации:", error);
      this.showError(
        this.lang === "ru"
          ? "Ошибка инициализации виджета"
          : "Widget initialization error"
      );
    }
  }

  async initAmoCRM() {
    return new Promise((resolve) => {
      if (typeof AmoCRM !== "undefined" && AmoCRM.onReady) {
        AmoCRM.onReady(() => {
          console.log("AmoCRM API готово");
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
    console.log("Загружены ID полей:", this.FIELD_IDS);
  }

  async setupSettingsHandlers() {
    try {
      // Проверяем доступность API AmoCRM и виджета настроек
      if (
        typeof AmoCRM === "undefined" ||
        !AmoCRM.widgets ||
        !AmoCRM.widgets.settings
      ) {
        console.log("API настроек недоступно");
        return;
      }

      // Получаем экземпляр настроек с обработкой ошибок
      var settings = await AmoCRM.widgets
        .settings(this.widgetInstanceId)
        .catch((error) => {
          console.error("Ошибка при получении настроек:", error);
          return null;
        });

      if (!settings || typeof settings.onSave !== "function") {
        console.log("Метод settings.onSave недоступен");
        return;
      }

      // Настраиваем обработчик сохранения
      settings.onSave(async () => {
        console.log("Настройки сохранены");
        this.loadFieldIds();
        await this.renderCalendar();
        return true; // Важно: возвращаем true для подтверждения сохранения
      });
    } catch (error) {
      console.error("Ошибка обработчика настроек:", error);
    }
  }

  async checkAuth() {
    try {
      this.showLoading(true);
      if (typeof AmoCRM !== "undefined" && AmoCRM.widgets?.system) {
        var system = await AmoCRM.widgets.system(this.widgetInstanceId);
        this.accessToken = system?.access_token || null;
      }
    } catch (error) {
      console.error("Ошибка авторизации:", error);
    } finally {
      this.showLoading(false);
    }
  }

  setupUI() {
    // Обновляем текущий месяц/год
    var monthYearElement = document.getElementById("currentMonthYear");
    if (monthYearElement) {
      monthYearElement.textContent = this.getCurrentMonthTitle();
    }

    // Обновляем текст кнопки авторизации
    var authButton = document.getElementById("authButton");
    if (authButton) {
      authButton.textContent =
        this.lang === "ru" ? "Авторизоваться в amoCRM" : "Authorize in amoCRM";
    }
  }

  getCurrentMonthTitle() {
    var months =
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
    this.isLoading = true;

    try {
      this.showLoading(true);
      var year = this.currentDate.getFullYear();
      var month = this.currentDate.getMonth();

      // Обновляем заголовок
      var monthYearElement = document.getElementById("currentMonthYear");
      if (monthYearElement) {
        monthYearElement.textContent = this.getCurrentMonthTitle();
      }

      // Загружаем данные
      this.dealsData = await this.fetchDeals(year, month);

      // Рендерим календарь
      this.renderCalendarGrid(year, month);
    } catch (error) {
      console.error("Ошибка отрисовки:", error);
      this.showError(
        this.lang === "ru" ? "Ошибка загрузки данных" : "Data loading error"
      );
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  renderCalendarGrid(year, month) {
    var calendarElement = document.getElementById("calendar");
    if (!calendarElement) return;

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var weekdays =
      this.lang === "ru"
        ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    var html = '<div class="weekdays">';
    weekdays.forEach((day) => {
      html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="days">';

    // Пустые дни в начале месяца
    for (var i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      html += '<div class="day empty"></div>';
    }

    // Дни месяца
    for (var day = 1; day <= daysInMonth; day++) {
      var date = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      var dealCount = this.dealsData[date]?.length || 0;

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
    var dealsContainer = document.getElementById("deals");
    var dateElement = document.getElementById("selected-date");

    if (!dealsContainer || !dateElement) return;

    // Форматируем дату
    dateElement.textContent = new Date(date).toLocaleDateString(this.lang, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    var deals = this.dealsData[date] || [];

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
    var fields = [
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
        var value = deal.custom_fields_values?.find(
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
      console.log("Нет токена доступа - пропускаем запрос к API");
      return {};
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(() => controller.abort(), 10000); // Таймаут 10 секунд

    try {
      var startDate = new Date(year, month, 1).toISOString().split("T")[0];
      var endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

      var params = new URLSearchParams({
        "filter[custom_fields_values][field_id]": this.FIELD_IDS.ORDER_DATE,
        "filter[custom_fields_values][from]": startDate,
        "filter[custom_fields_values][to]": endDate,
      });

      var response = await fetch(
        `https://spacebakery1.amocrm.ru/api/v4/leads?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "X-Requested-With": "XMLHttpRequest",
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
      return this.processDealsData(await response.json());
    } catch (error) {
      console.error("Ошибка загрузки сделок:", error);
      this.showError(
        this.lang === "ru"
          ? "Ошибка при загрузке сделок"
          : "Error loading deals"
      );
      return {};
    } finally {
      clearTimeout(timeoutId);
    }
  }

  processDealsData(data) {
    if (!data?._embedded?.leads) return {};

    return data._embedded.leads.reduce((acc, deal) => {
      var dateField = deal.custom_fields_values?.find(
        (f) => f.field_id == this.FIELD_IDS.ORDER_DATE
      );
      var date =
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
    var params = new URLSearchParams({
      client_id: "f178be80-a7bf-40e5-8e70-196a5d4a775c",
      redirect_uri: "https://alerom2006.github.io/Calendar/oauth_callback.html",
      state: this.widgetInstanceId,
    });
    window.location.href = `https://spacebakery1.amocrm.ru/oauth2/authorize?${params}`;
  }

  showLoading(show) {
    this.isLoading = show;
    var loader = document.getElementById("loader");
    if (loader) {
      loader.style.display = show ? "block" : "none";
    }
  }

  showError(message) {
    var errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove("d-none");
    }
  }

  showStandaloneWarning() {
    console.warn("Запуск в автономном режиме");
    var warning = document.createElement("div");
    warning.className = "alert alert-warning";
    warning.textContent =
      this.lang === "ru"
        ? "Виджет работает без интеграции с amoCRM"
        : "Widget running without amoCRM integration";
    document.body.prepend(warning);
  }
}

// Инициализация виджета
document.addEventListener("DOMContentLoaded", async () => {
  try {
    var widget = new OrdersCalendar();

    // Добавляем небольшую задержку для полной загрузки
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Скрываем индикатор загрузки, если он все еще отображается
    widget.showLoading(false);
  } catch (error) {
    console.error("Ошибка инициализации виджета:", error);
    var errorElement = document.getElementById("error-alert");
    if (errorElement) {
      errorElement.textContent =
        "Ошибка загрузки виджета. Пожалуйста, обновите страницу.";
      errorElement.classList.remove("d-none");
    }
  }
});

class OrdersCalendar {
  constructor() {
    this.safeMode = false;
    this.init();
  }

  async init() {
    try {
      await this.detectEnvironment();
      await this.loadSettings();
      await this.setupWidget();
      this.renderUI();
    } catch (error) {
      this.handleCriticalError(error);
    }
  }

  async detectEnvironment() {
    if (typeof AmoCRM === "undefined") {
      this.safeMode = true;
      return;
    }

    try {
      await new Promise((resolve) => {
        if (AmoCRM.onReady) {
          AmoCRM.onReady(resolve);
        } else {
          setTimeout(resolve, 1500);
        }
      });

      if (!AmoCRM.widgets?.settings) {
        this.safeMode = true;
      }
    } catch {
      this.safeMode = true;
    }
  }

  async loadSettings() {
    this.settings = {
      deal_date_field_id: 885453,
      delivery_range_field: 892009,
    };

    if (this.safeMode) return;

    try {
      const loadedSettings = await new Promise((resolve) => {
        setTimeout(() => resolve(window.widgetSettings || {}), 1000);
      });
      Object.assign(this.settings, loadedSettings);
    } catch {
      this.safeMode = true;
    }
  }

  async setupWidget() {
    if (this.safeMode) return;

    try {
      this.widgetInstance = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(null);
        }, 2000);

        if (AmoCRM.widgets?.create) {
          AmoCRM.widgets.create("OrdersCalendar", (widget) => {
            clearTimeout(timeout);
            resolve(widget);
          });
        } else {
          clearTimeout(timeout);
          resolve(null);
        }
      });

      if (!this.widgetInstance) {
        this.safeMode = true;
      }
    } catch {
      this.safeMode = true;
    }
  }

  renderUI() {
    if (this.safeMode) {
      this.renderStandaloneUI();
      return;
    }

    try {
      this.widgetInstance.render({
        template: this.getMainTemplate(),
        data: {},
      });

      this.widgetInstance.on("save", () => this.handleSave());
    } catch {
      this.safeMode = true;
      this.renderStandaloneUI();
    }
  }

  getMainTemplate() {
    return `
      <div class="calendar-widget">
        <div class="header">
          <h2>Календарь заказов</h2>
        </div>
        <div class="content">
          ${this.getCalendarTemplate()}
        </div>
      </div>
    `;
  }

  getCalendarTemplate() {
    const date = new Date();
    return `
      <div class="calendar">
        <div class="month-header">
          <button class="prev-month">&lt;</button>
          <span>${this.getMonthName(date)} ${date.getFullYear()}</span>
          <button class="next-month">&gt;</button>
        </div>
        <div class="days-grid"></div>
      </div>
    `;
  }

  getMonthName(date) {
    const months = [
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
    return months[date.getMonth()];
  }

  renderStandaloneUI() {
    const container =
      document.getElementById("widget-container") || document.body;
    container.innerHTML = this.getMainTemplate();
  }

  async handleSave() {
    try {
      if (this.safeMode) return false;

      await this.loadSettings();
      return { status: "success" };
    } catch {
      return { status: "error" };
    }
  }

  handleCriticalError(error) {
    console.error("CRITICAL ERROR:", error);
    const errorContainer = document.createElement("div");
    errorContainer.className = "error-container";
    errorContainer.innerHTML = `
      <p>Виджет временно недоступен</p>
      <button class="retry-btn">Попробовать снова</button>
    `;
    (document.getElementById("widget-container") || document.body).appendChild(
      errorContainer
    );

    errorContainer.querySelector(".retry-btn").addEventListener("click", () => {
      errorContainer.remove();
      this.init();
    });
  }
}

// Запуск с максимальной защитой
try {
  document.addEventListener("DOMContentLoaded", () => {
    new OrdersCalendar();
  });
} catch (e) {
  console.error("Global initialization failed:", e);
}

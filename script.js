// Универсальный виджет календаря заказов для amoCRM
(function (root, factory) {
  // Проверяем режим работы (AMD для amoCRM или обычный)
  if (typeof define === "function" && define.amd) {
    define(["jquery"], factory);
  } else {
    root.OrdersCalendarWidget = factory(root.jQuery || {});
  }
})(this, function ($) {
  "use strict";

  // Константы виджета
  const VERSION = "1.0.14";
  console.log(`Календарь заказов ${VERSION} загружен`);

  function OrdersCalendarWidget() {
    // Внутреннее состояние виджета
    const state = {
      initialized: false, // Флаг инициализации
      system: null, // Данные системы amoCRM
      currentDate: new Date(), // Текущая дата (месяц для отображения)
      dealsData: {}, // Данные по сделкам
      fieldIds: {
        ORDER_DATE: 885453, // ID поля с датой заказа по умолчанию
      },
      isStandalone: typeof AmoCRM === "undefined", // Режим работы (вне amoCRM)
    };

    // Вспомогательные функции
    const utils = {
      // Безопасное получение данных из объекта по пути
      safeAccess: (obj, path, defaultValue = null) => {
        return path
          .split(".")
          .reduce(
            (o, p) => (o && o[p] !== undefined ? o[p] : defaultValue),
            obj
          );
      },

      // Форматирование даты в YYYY-MM-DD
      formatDate: (date) => {
        return date.toISOString().split("T")[0];
      },

      // Получение количества дней в месяце
      getDaysInMonth: (year, month) => {
        return new Date(year, month + 1, 0).getDate();
      },

      // Получение названия месяца
      getMonthName: (monthIndex) => {
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
        return months[monthIndex] || "";
      },
    };

    // Сервис работы с API amoCRM
    const apiService = {
      // Проверка доступности API
      isAvailable: () => {
        try {
          return (
            !state.isStandalone &&
            typeof AmoCRM !== "undefined" &&
            typeof utils.safeAccess(AmoCRM, "widgets.system", null) ===
              "function" &&
            typeof utils.safeAccess(AmoCRM, "request", null) === "function"
          );
        } catch (e) {
          console.warn("Ошибка проверки API:", e);
          return false;
        }
      },

      // Безопасный запрос к API
      request: async (method, endpoint, params = {}) => {
        if (!apiService.isAvailable()) {
          console.log("API недоступно - используем тестовые данные");
          return { _embedded: { leads: [] } };
        }

        try {
          const response = await AmoCRM.request(method, endpoint, params);
          return response || { _embedded: { leads: [] } };
        } catch (error) {
          console.error("Ошибка запроса к API:", error);
          return { _embedded: { leads: [] } };
        }
      },

      // Получение системной информации
      getSystem: async () => {
        if (!apiService.isAvailable()) return {};
        try {
          return await AmoCRM.widgets.system();
        } catch (error) {
          console.error("Ошибка получения системной информации:", error);
          return {};
        }
      },
    };

    // Сервис работы с данными
    const dataService = {
      // Загрузка сделок
      loadDeals: async () => {
        const dateFrom = new Date(
          state.currentDate.getFullYear(),
          state.currentDate.getMonth(),
          1
        );
        const dateTo = new Date(
          state.currentDate.getFullYear(),
          state.currentDate.getMonth() + 1,
          0
        );

        const response = await apiService.request("GET", "/api/v4/leads", {
          filter: {
            [state.fieldIds.ORDER_DATE]: {
              from: Math.floor(dateFrom.getTime() / 1000),
              to: Math.floor(dateTo.getTime() / 1000),
            },
          },
          limit: 250,
        });

        return utils.safeAccess(response, "_embedded.leads", []);
      },

      // Обработка данных сделок
      processDeals: (deals) => {
        state.dealsData = {};
        (deals || []).forEach((deal) => {
          try {
            // Ищем поле с датой заказа
            const dateField = (deal.custom_fields_values || []).find(
              (f) => f && f.field_id === state.fieldIds.ORDER_DATE
            );

            if (dateField?.values?.[0]?.value) {
              const date = new Date(dateField.values[0].value * 1000);
              const dateStr = utils.formatDate(date);

              // Группируем сделки по датам
              state.dealsData[dateStr] = state.dealsData[dateStr] || [];
              state.dealsData[dateStr].push({
                id: deal.id || 0,
                name: deal.name || "Без названия",
                status_id: deal.status_id || 0,
                price: deal.price || 0,
              });
            }
          } catch (e) {
            console.warn("Ошибка обработки сделки:", e);
          }
        });
      },

      // Генерация тестовых данных
      getMockData: () => {
        const data = {};
        const days = utils.getDaysInMonth(
          state.currentDate.getFullYear(),
          state.currentDate.getMonth()
        );

        // Создаем тестовые сделки (каждую 5-ю дату и первую)
        for (let i = 1; i <= days; i++) {
          if (i % 5 === 0 || i === 1) {
            const date = `${state.currentDate.getFullYear()}-${(
              state.currentDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}-${i.toString().padStart(2, "0")}`;
            data[date] = [
              {
                id: i,
                name: `Тестовая сделка ${i}`,
                status_id: 143,
                price: i * 1000,
              },
            ];
          }
        }
        return data;
      },
    };

    // Сервис работы с интерфейсом
    const uiService = {
      // Генерация HTML календаря
      generateCalendar: () => {
        try {
          const month = state.currentDate.getMonth();
          const year = state.currentDate.getFullYear();
          const daysInMonth = utils.getDaysInMonth(year, month);
          const firstDay = new Date(year, month, 1).getDay();
          const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

          let html = '<div class="calendar-grid">';

          // Заголовки дней недели
          ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].forEach((day) => {
            html += `<div class="calendar-weekday">${day}</div>`;
          });

          // Пустые ячейки перед первым днем месяца
          for (let i = 0; i < adjustedFirstDay; i++) {
            html += '<div class="calendar-day empty"></div>';
          }

          // Ячейки с днями месяца
          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${(month + 1)
              .toString()
              .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
            const deals = utils.safeAccess(state.dealsData, dateStr, []);
            const isToday = dateStr === utils.formatDate(new Date());

            html += `
              <div class="calendar-day ${isToday ? "today" : ""} ${
              deals.length ? "has-deals" : ""
            }" data-date="${dateStr}">
                ${day}
                ${
                  deals.length
                    ? `<span class="deal-badge">${deals.length}</span>`
                    : ""
                }
              </div>
            `;
          }

          html += "</div>";

          // Возвращаем полный HTML календаря
          return `
            <div class="orders-calendar">
              <div class="calendar-header">
                <h4>Календарь заказов</h4>
                <div class="calendar-nav">
                  <button class="prev-month" aria-label="Предыдущий месяц">←</button>
                  <span class="current-month">${utils.getMonthName(
                    month
                  )} ${year}</span>
                  <button class="next-month" aria-label="Следующий месяц">→</button>
                </div>
              </div>
              ${html}
            </div>
          `;
        } catch (error) {
          console.error("Ошибка генерации календаря:", error);
          return '<div class="error">Ошибка при создании календаря</div>';
        }
      },

      // Отображение календаря
      render: (html) => {
        const container = document.getElementById("widget-root");
        if (container) {
          // Вставляем HTML
          container.innerHTML = html;

          // Навешиваем обработчики на кнопки навигации
          container
            .querySelector(".prev-month")
            ?.addEventListener("click", () => {
              state.currentDate.setMonth(state.currentDate.getMonth() - 1);
              widgetService.renderWidget();
            });

          container
            .querySelector(".next-month")
            ?.addEventListener("click", () => {
              state.currentDate.setMonth(state.currentDate.getMonth() + 1);
              widgetService.renderWidget();
            });
        }

        // Если работаем внутри amoCRM, используем их систему рендеринга
        if (!state.isStandalone && typeof this.render_template === "function") {
          try {
            this.render_template({
              body: html,
              caption: { class_name: "orders-calendar-caption" },
            });
          } catch (e) {
            console.warn("Ошибка рендеринга шаблона:", e);
          }
        }
      },
    };

    // Основной сервис виджета
    const widgetService = {
      // Инициализация виджета
      init: async () => {
        if (state.initialized) return true;

        try {
          // Получаем данные системы
          const system = await apiService.getSystem();
          state.system = system;

          // Обновляем ID поля с датой, если задано в настройках
          const fieldId = utils.safeAccess(
            system,
            "settings.deal_date_field_id"
          );
          if (fieldId) {
            state.fieldIds.ORDER_DATE = parseInt(fieldId) || 885453;
          }

          state.initialized = true;
          return true;
        } catch (error) {
          console.error("Ошибка инициализации:", error);
          state.initialized = true;
          return true;
        }
      },

      // Загрузка данных
      loadData: async () => {
        try {
          const deals = await dataService.loadDeals();
          dataService.processDeals(deals);
        } catch (error) {
          console.error("Ошибка загрузки данных:", error);
          // В случае ошибки используем тестовые данные
          state.dealsData = dataService.getMockData();
        }
      },

      // Основной метод отрисовки виджета
      renderWidget: async () => {
        try {
          await widgetService.init();
          await widgetService.loadData();
          const calendarHTML = uiService.generateCalendar();
          uiService.render(calendarHTML);
        } catch (error) {
          console.error("Ошибка отрисовки виджета:", error);
          // При ошибке используем тестовые данные и пробуем отрисовать снова
          state.dealsData = dataService.getMockData();
          uiService.render(uiService.generateCalendar());
        }
      },
    };

    // Публичное API для amoCRM
    this.callbacks = {
      init: (system) => widgetService.init().then(() => true),
      render: () => widgetService.renderWidget().then(() => true),
      onSave: (settings) => {
        try {
          // Обновляем ID поля при сохранении настроек
          const fieldId = utils.safeAccess(settings, "deal_date_field_id");
          if (fieldId) state.fieldIds.ORDER_DATE = parseInt(fieldId) || 885453;
        } catch (e) {
          console.warn("Ошибка сохранения настроек:", e);
        }
        return true;
      },
      bind_actions: () => true,
      destroy: () => true,
    };

    return this;
  }

  // Регистрация виджета в amoCRM
  if (typeof AmoCRM !== "undefined" && typeof AmoCRM.Widget !== "undefined") {
    try {
      AmoCRM.Widget.register(OrdersCalendarWidget);
      console.log("Виджет зарегистрирован в amoCRM");
    } catch (e) {
      console.error("Ошибка регистрации виджета:", e);
    }
  }

  // Автоинициализация в standalone режиме
  if (
    typeof OrdersCalendarWidget !== "undefined" &&
    typeof AmoCRM === "undefined"
  ) {
    document.addEventListener("DOMContentLoaded", () => {
      try {
        new OrdersCalendarWidget().renderWidget();
      } catch (e) {
        console.error("Ошибка инициализации в standalone режиме:", e);
      }
    });
  }

  return OrdersCalendarWidget;
});

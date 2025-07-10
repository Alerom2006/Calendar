define(["jquery"], function ($) {
  var OrdersCalendarWidget = function () {
    if (typeof OrdersCalendarWidget.instance === "object") {
      return OrdersCalendarWidget.instance;
    }

    var self = this;
    OrdersCalendarWidget.instance = this;

    // 1. УЛУЧШЕННАЯ ИНИЦИАЛИЗАЦИЯ И ПРОВЕРКА API
    this.initializeAPI = function () {
      try {
        console.group("Инициализация API");

        // Проверка доступности AMOCRM API
        const isAMOCRMLoaded = typeof AMOCRM !== "undefined";
        const hasAMOCRMConstant =
          isAMOCRMLoaded && typeof AMOCRM.constant === "function";
        const hasAMOCRMRequest =
          isAMOCRMLoaded && typeof AMOCRM.request === "function";

        // Проверка дополнительных API (ARCAR)
        const isARCARLoaded = typeof ARCAR !== "undefined";
        const hasARCARMethods =
          isARCARLoaded && typeof ARCAR.gettypes === "function";

        console.log("AMOCRM API статус:", {
          loaded: isAMOCRMLoaded,
          constant: hasAMOCRMConstant,
          request: hasAMOCRMRequest,
        });

        console.log("ARCAR API статус:", {
          loaded: isARCARLoaded,
          methods: hasARCARMethods,
        });

        // Определение режима работы
        this.isStandalone = !(
          isAMOCRMLoaded &&
          hasAMOCRMConstant &&
          hasAMOCRMRequest
        );

        if (this.isStandalone) {
          console.warn("Режим STANDALONE: API недоступен");
        } else {
          console.log("Режим INTEGRATED: API доступен");
        }

        console.groupEnd();
        return !this.isStandalone;
      } catch (e) {
        console.error("Ошибка инициализации API:", e);
        this.isStandalone = true;
        return false;
      }
    };

    // 2. ЗАЩИТА ОТ ОШИБОК "UNDEFINED"
    this.safeAccess = function (obj, prop, defaultValue = null) {
      try {
        return obj && obj[prop] !== undefined ? obj[prop] : defaultValue;
      } catch (e) {
        console.warn(`Ошибка доступа к свойству ${prop}:`, e);
        return defaultValue;
      }
    };

    // 3. ОБРАБОТКА ОШИБОК API
    this.handleAPIError = function (error, context = "") {
      console.error(`Ошибка API ${context}:`, error);

      let errorMessage = "Ошибка подключения к API";
      if (error instanceof TypeError) {
        errorMessage = "Недоступны методы API";
      } else if (error.message) {
        errorMessage = error.message;
      }

      this.showError(errorMessage, context);
      return { error: true, message: errorMessage };
    };

    // 4. УЛУЧШЕННЫЙ МЕТОД ДЛЯ ЗАПРОСОВ
    this.apiRequest = function (method, endpoint, data = {}, options = {}) {
      return new Promise((resolve) => {
        if (this.isStandalone) {
          console.warn("Standalone режим: эмуляция запроса к", endpoint);
          setTimeout(() => resolve(this.mockResponse(method, endpoint)), 300);
          return;
        }

        try {
          // Определение используемого API
          const api = endpoint.includes("/arcar/") ? ARCAR : AMOCRM;

          if (typeof api === "undefined" || typeof api.request !== "function") {
            throw new Error(
              `API ${
                endpoint.includes("/arcar/") ? "ARCAR" : "AMOCRM"
              } недоступен`
            );
          }

          console.log("Отправка запроса:", { method, endpoint });

          api
            .request({ method, path: endpoint, data, ...options })
            .then((response) => {
              if (!response) throw new Error("Пустой ответ от сервера");
              resolve(response);
            })
            .catch((error) => {
              resolve(this.handleAPIError(error, `при запросе ${endpoint}`));
            });
        } catch (e) {
          resolve(this.handleAPIError(e, `при обработке запроса ${endpoint}`));
        }
      });
    };

    // 5. ИНИЦИАЛИЗАЦИЯ ВИДЖЕТА
    this.init = function () {
      try {
        console.group("Инициализация виджета");

        // Проверка API
        const apiAvailable = this.initializeAPI();

        // Получение данных только если API доступен
        if (apiAvailable) {
          this.accountData = this.safeAccess(AMOCRM, 'constant("account")', {});
          this.userData = this.safeAccess(AMOCRM, 'constant("user")', {});
          this.currentCard = this.safeAccess(AMOCRM, "data.current_card", {});

          console.log("Данные инициализированы:", {
            account: this.accountData,
            user: this.userData,
            card: this.currentCard,
          });
        }

        // Установка языковых настроек с защитой от ошибок
        this.langs = {
          ru: {
            widget: { name: "Календарь заказов" },
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
              apiError: "Ошибка API",
              noData: "Данные недоступны",
            },
          },
        };

        // Инициализация состояния
        this.state = {
          initialized: true,
          currentDate: new Date(),
          dealsData: {},
          loading: false,
          fieldIds: { ORDER_DATE: 885453 },
          statuses: {
            142: "Новая",
            143: "В работе",
            144: "Завершена",
            145: "Отменена",
          },
        };

        console.log("Виджет успешно инициализирован");
        console.groupEnd();
        return true;
      } catch (e) {
        console.error("Ошибка инициализации:", e);
        this.showError("Ошибка инициализации виджета", "init");
        console.groupEnd();
        return false;
      }
    };

    // 6. ПОЛНАЯ ПЕРЕЗАГРУЗКА ВИДЖЕТА
    this.fullReload = function () {
      try {
        console.log("Полная перезагрузка виджета...");
        this.state.initialized = false;
        this.state.dealsData = {};
        this.init().then(() => this.renderCalendar());
      } catch (e) {
        console.error("Ошибка перезагрузки:", e);
      }
    };

    // 7. CALLBACK-ФУНКЦИИ ДЛЯ AMOCRM
    this.callbacks = {
      init: function () {
        return new Promise((resolve) => {
          resolve(self.init());
        });
      },

      render: function () {
        return new Promise((resolve) => {
          self.renderCalendar().then(() => resolve(true));
        });
      },

      onSave: function (settings) {
        return new Promise((resolve) => {
          try {
            const result = self.applySettings(settings);
            resolve(result);
          } catch (e) {
            console.error("Ошибка сохранения:", e);
            resolve(false);
          }
        });
      },

      bind_actions: function () {
        try {
          self.bindCalendarEvents();
          return true;
        } catch (e) {
          console.error("Ошибка bind_actions:", e);
          return false;
        }
      },
    };

    // Первичная инициализация
    this.init();
    return this;
  };

  return OrdersCalendarWidget;
});

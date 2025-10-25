const axios = require('axios');
const { fixRussianEncoding } = require('./fix-encoding');

class LLMClient {
  constructor() {
    this.baseUrl = process.env.LLM_SERVER_URL || 'http://usa:3002';
    this.defaultModel = process.env.LLM_MODEL || 'FAST';
    this.requestTimeout = parseInt(process.env.LLM_REQUEST_TIMEOUT) || 30000;
  }

  async generateTaskPlan(taskTitle) {
    const systemPrompt = `Ты — AI-планировщик задач. Твоя задача: разбить пользовательскую задачу на конкретные, выполнимые шаги И дать свои соображения по выполнению.

ВАЖНО ПРО ФОРМАТ ОТВЕТА:
- Ответ ОБЯЗАТЕЛЬНО должен содержать ДВА раздела: ПЛАН и СООБРАЖЕНИЯ
- Раздел ПЛАН должен начинаться с маркера "ПЛАН:"
- Раздел СООБРАЖЕНИЯ должен начинаться с маркера "СООБРАЖЕНИЯ:"

ТРЕБОВАНИЯ К ПЛАНУ:
- Каждый шаг должен быть чётким и конкретным
- Шагов должно быть от 1 до 10
- Формат СТРОГО: одна строка = один шаг
- НЕ используй нумерацию в шагах, только текст
- Пиши на русском языке

ТРЕБОВАНИЯ К СООБРАЖЕНИЯМ:
- Опиши важные моменты, которые стоит учесть
- Предупреди о потенциальных сложностях
- Дай рекомендации по выполнению
- 2-4 предложения

Пример для задачи "Настроить Docker для проекта":

ПЛАН:
Установить Docker Desktop на Windows
Создать Dockerfile для приложения
Написать docker-compose.yml с настройками
Собрать образ и запустить контейнер
Проверить работоспособность приложения в контейнере

СООБРАЖЕНИЯ:
При работе с Docker на Windows важно убедиться, что включен WSL2 для лучшей производительности. Обратите внимание на размер финального образа - используйте multi-stage builds для оптимизации. Не забудьте добавить .dockerignore для исключения ненужных файлов. Рекомендую начать с простого Dockerfile и постепенно добавлять оптимизации.`;

    // Исправляем кодировку в названии задачи
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    
    const userPrompt = `Задача: "${fixedTaskTitle}"

Распиши план выполнения этой задачи и дай свои соображения:`;

    try {
      console.log(`\n🧠 Генерирую план для задачи: "${taskTitle}"...`);
      console.log(`📡 Подключаюсь к: ${this.baseUrl}/api/send-request`);
      console.log(`📝 Модель: ${this.defaultModel}`);
      
      const requestData = {
        model: this.defaultModel,
        prompt: systemPrompt,
        inputText: userPrompt,
        saveResponse: false
      };
      
      console.log(`📤 Отправляю запрос:`, JSON.stringify(requestData, null, 2));
      
      // Проверяем доступность сервера перед отправкой запроса
      try {
        console.log(`🔍 Проверяю доступность сервера...`);
        await axios.get(`${this.baseUrl}`, { timeout: parseInt(process.env.LLM_HEALTH_TIMEOUT) || 2000 });
        console.log(`✅ Сервер доступен`);
      } catch (healthError) {
        console.error(`❌ LLM сервер недоступен: ${healthError.message}`);
        console.error(`📡 URL: ${this.baseUrl}`);

        if (healthError.code === 'ECONNREFUSED') {
          console.error(`❌ Не удается подключиться к серверу на ${this.baseUrl}`);
          console.error(`   Убедитесь что:`);
          console.error(`   1. Сервер запущен на порту указанном в LLM_SERVER_URL`);
          console.error(`   2. Нет firewall блокировки`);
          console.error(`   3. Сервер слушает на правильном порту`);
        } else if (healthError.code === 'ENOTFOUND') {
          console.error(`❌ Не удается разрешить адрес сервера`);
          console.error(`   Проверьте настройки LLM_SERVER_URL`);
        } else if (healthError.code === 'ETIMEDOUT') {
          console.error(`❌ Таймаут подключения к серверу`);
          console.error(`   Сервер отвечает слишком медленно или недоступен`);
        }

        throw new Error(`LLM сервер недоступен: ${healthError.message}`);
      }
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: this.requestTimeout
      });

      console.log(`📥 Получен ответ от LLM:`, JSON.stringify(response.data, null, 2));
      
      const planText = response.data.content || response.data.response || response.data.result || '';
      console.log(`📄 Текст ответа:\n${planText}\n`);
      
      // Парсим ответ: извлекаем план и соображения
      const parsed = this.parsePlanAndConsiderations(planText);
      
      console.log(`✅ План создан: ${parsed.steps.length} шагов\n`);
      console.log(`📋 Шаги плана:`);
      parsed.steps.forEach((step, idx) => {
        console.log(`   ${idx + 1}. ${step}`);
      });
      
      if (parsed.considerations) {
        console.log(`\n💡 Соображения ИИ:\n${parsed.considerations}\n`);
      }
      
      return parsed;
    } catch (error) {
      console.error(`\n❌ Ошибка при обращении к LLM: ${error.message}`);
      console.error(`🔍 Детали ошибки:`, error);
      console.log(`\n⚠️ Использую базовый план вместо LLM\n`);
      
      // Возвращаем базовый план в случае ошибки
      return {
        steps: [
          `Анализ задачи "${taskTitle}"`,
          'Подготовка необходимых ресурсов',
          'Выполнение основных действий',
          'Проверка результатов'
        ],
        considerations: null
      };
    }
  }

  /**
   * Парсит ответ LLM, извлекая план, соображения или вопросы
   * @param {string} text - Текст ответа от LLM
   * @returns {Object} - Объект с результатом парсинга
   */
  parsePlanAndConsiderations(text) {
    // 1. Проверяем наличие секции ВОПРОСЫ:
    const questionsMatch = text.match(/ВОПРОСЫ:\s*([\s\S]*?)$/i);
    if (questionsMatch) {
      const questionsSection = questionsMatch[1].trim();
      const questions = questionsSection
        .split('\n')
        .map(line => line.replace(/^[\-\*\d\.\)]\s*/, '').trim())
        .filter(line => line.length > 5);
      
      if (questions.length > 0) {
        return {
          type: 'questions',
          questions: questions
        };
      }
    }

    // 2. Если вопросов нет, ищем план и соображения
    let planSection = '';
    let considerationsSection = '';
    
    // Ищем секции ПЛАН: и СООБРАЖЕНИЯ:
    const planMatch = text.match(/ПЛАН:\s*([\s\S]*?)(?=СООБРАЖЕНИЯ:|ВОПРОСЫ:|$)/i);
    const considerationsMatch = text.match(/СООБРАЖЕНИЯ:\s*([\s\S]*?)(?=ВОПРОСЫ:|$)/i);
    
    if (planMatch) {
      planSection = planMatch[1].trim();
    } else {
      // Если маркер ПЛАН: не найден, используем весь текст до СООБРАЖЕНИЯ:
      const beforeConsiderations = text.split(/СООБРАЖЕНИЯ:|ВОПРОСЫ:/i)[0];
      planSection = beforeConsiderations.trim();
    }
    
    if (considerationsMatch) {
      considerationsSection = considerationsMatch[1].trim();
    }
    
    // Парсим шаги плана
    let lines = planSection
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
    
    // Обрабатываем строки
    const steps = lines
      .map(line => {
        // Убираем возможную нумерацию типа "1.", "1)", "- "
        return line.replace(/^\d+[\.\)\]]\s*/, '').replace(/^[\-\*]\s*/, '').trim();
      })
      .filter(line => line.length > 10) // Фильтруем слишком короткие строки
      .filter(line => !/^Project setup|^Layer \d|^These steps|^The framework|^But |^In conclusion,/i.test(line)); // Фильтруем строки с метаданными
    
    return {
      type: 'plan',
      steps: steps.length > 0 ? steps : ['Выполнить основные действия'],
      considerations: considerationsSection || null
    };
  }

  /**
   * Генерирует детальный план для подзадачи
   * @param {string} subtaskTitle - Название подзадачи
   * @param {string} parentTaskTitle - Название родительской задачи
   * @returns {Array} - Массив шагов для подзадачи
   */
  async generateSubtaskPlan(subtaskTitle, parentTaskTitle) {
    const systemPrompt = `Ты — AI-планировщик задач. Твоя задача: разбить подзадачу на конкретные, выполнимые микро-шаги.

ВАЖНО:
- Каждый шаг должен быть максимально конкретным и детальным
- Шагов должно быть от 1 до 10
- Формат СТРОГО: одна строка = один шаг
- НЕ используй нумерацию, только текст шага
- Пиши на русском языке
- Учитывай контекст родительской задачи

Пример для подзадачи "Создать модель пользователя" в контексте "Создать REST API":
Определить поля модели: id, username, email, password_hash, created_at
Создать файл models/User.js с описанием схемы
Добавить валидацию полей (email формат, длина пароля)
Настроить связи с другими моделями если нужно
Протестировать создание и сохранение модели в БД`;

    const fixedSubtaskTitle = fixRussianEncoding(subtaskTitle);
    const fixedParentTitle = fixRussianEncoding(parentTaskTitle);
    
    const userPrompt = `Родительская задача: "${fixedParentTitle}"
Подзадача: "${fixedSubtaskTitle}"

Распиши детальный план выполнения этой подзадачи:`;

    try {
      console.log(`\n🧠 Генерирую детальный план для подзадачи: "${subtaskTitle}"...`);
      
      const requestData = {
        model: this.defaultModel,
        prompt: systemPrompt,
        inputText: userPrompt,
        saveResponse: false
      };
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: this.requestTimeout
      });

      const planText = response.data.content || response.data.response || response.data.result || '';
      
      // Парсим ответ модели в массив шагов
      let lines = planText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
      
      // Если ответ слишком длинный, берем последний блок с русским текстом
      if (lines.length > 15) {
        let russianBlockIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (/[а-яА-ЯёЁ]/.test(lines[i])) {
            russianBlockIndex = i;
            while (russianBlockIndex > 0 && 
                  (/[а-яА-ЯёЁ]/.test(lines[russianBlockIndex - 1]) || lines[russianBlockIndex - 1] === '')) {
              russianBlockIndex--;
            }
            break;
          }
        }
        
        if (russianBlockIndex !== -1) {
          lines = lines.slice(russianBlockIndex);
        }
      }
      
      const steps = lines
        .map(line => line.replace(/^\d+[\.\)\]]\s*/, '').replace(/^[\-\*]\s*/, '').trim())
        .filter(line => line.length > 10)
        .filter(line => !/^Project setup|^Layer \d|^These steps|^The framework|^But |^In conclusion,/.test(line));

      console.log(`✅ План подзадачи создан: ${steps.length} шагов\n`);
      
      return steps;
    } catch (error) {
      console.error(`\n❌ Ошибка при обращении к LLM: ${error.message}`);
      console.log(`\n⚠️ Использую базовый план для подзадачи\n`);
      
      return [
        `Изучить требования для "${subtaskTitle}"`,
        'Подготовить необходимые ресурсы и инструменты',
        'Выполнить основную работу',
        'Проверить результат и задокументировать'
      ];
    }
  }

  /**
   * Генерирует план задачи с учетом контекста пользователя или задает уточняющие вопросы
   * @param {string} taskTitle - Название задачи
   * @param {string} userContext - Соображения и контекст от пользователя
   * @returns {Object} - Объект с планом или вопросами
   */
  async generateTaskPlanWithContext(taskTitle, userContext) {
    const systemPrompt = `Ты — AI-планировщик задач. Твоя задача — проанализировать задачу пользователя и либо составить план, либо задать уточняющие вопросы.

АНАЛИЗ ЗАДАЧИ:
1. Оцени ясность и полноту задачи. Достаточно ли информации для составления конкретного плана?
2. Если задача ясна, переходи к созданию плана.
3. Если задача слишком общая, неоднозначная или сложная, твоя ОБЯЗАННОСТЬ — задать уточняющие вопросы.

ВАРИАНТ 1: ЗАДАЧА ЯСНА (ПЛАН + СООБРАЖЕНИЯ)
- Ответ ОБЯЗАТЕЛЬНО должен содержать ДВА раздела: ПЛАН и СООБРАЖЕНИЯ.
- Раздел ПЛАН начинается с "ПЛАН:".
- Раздел СООБРАЖЕНИЯ начинается с "СООБРАЖЕНИЯ:".

ТРЕБОВАНИЯ К ПЛАНУ:
- Каждый шаг должен быть чётким и конкретным
- Шагов должно быть от 1 до 10
- Формат СТРОГО: одна строка = один шаг
- НЕ используй нумерацию в шагах, только текст
- Пиши на русском языке
- ВНИМАТЕЛЬНО учитывай контекст и соображения пользователя при планировании

ТРЕБОВАНИЯ К СООБРАЖЕНИЯМ:
- Опиши важные моменты, которые стоит учесть
- Предупреди о потенциальных сложностях
- Дай рекомендации по выполнению
- Учитывай соображения пользователя и дополняй их своими
- 2-4 предложения

ВАРИАНТ 2: ЗАДАЧА НЕЯСНА (ВОПРОСЫ)
- Если информация недостаточна, ответ должен содержать ТОЛЬКО ОДИН раздел: ВОПРОСЫ.
- Раздел ВОПРОСЫ начинается с "ВОПРОСЫ:".

ТРЕБОВАНИЯ К ВОПРОСАМ:
- Задай от 2 до 5 ключевых вопросов, которые помогут прояснить задачу.
- Вопросы должны быть четкими и по существу.
- Формат: одна строка = один вопрос. БЕЗ нумерации.

Пример ответа с планом:
ПЛАН:
Установить Docker Desktop на Windows
Создать Dockerfile для приложения
Написать docker-compose.yml с настройками
Собрать образ и запустить контейнер
Проверить работоспособность приложения в контейнере

СООБРАЖЕНИЯ:
При работе с Docker на Windows важно убедиться, что включен WSL2 для лучшей производительности. Обратите внимание на размер финального образа - используйте multi-stage builds для оптимизации. Не забудьте добавить .dockerignore для исключения ненужных файлов.

Пример ответа с вопросами (для задачи "Оптимизировать сайт"):
ВОПРОСЫ:
Какой аспект сайта требует оптимизации (скорость загрузки, SEO, мобильная версия)?
Есть ли доступ к серверным логам и аналитике (Google Analytics, etc.)?
Какие технологии используются на фронтенде и бэкенде?
Существуют ли конкретные метрики производительности (LCP, FID), которые нужно улучшить?`;

    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    const fixedUserContext = fixRussianEncoding(userContext);
    
    const userPrompt = `Задача: "${fixedTaskTitle}"

Контекст и соображения пользователя:
${fixedUserContext}

Проанализируй задачу и либо распиши план, либо задай уточняющие вопросы:`;

    try {
      console.log(`\n🧠 Анализирую задачу и генерирую ответ...`);
      console.log(`📡 Подключаюсь к: ${this.baseUrl}/api/send-request`);
      console.log(`📝 Модель: ${this.defaultModel}`);
      
      const requestData = {
        model: this.defaultModel,
        prompt: systemPrompt,
        inputText: userPrompt,
        saveResponse: false
      };
      
      // Проверяем доступность сервера перед отправкой запроса
      try {
        console.log(`🔍 Проверяю доступность сервера...`);
        await axios.get(`${this.baseUrl}`, { timeout: parseInt(process.env.LLM_HEALTH_TIMEOUT) || 2000 });
        console.log(`✅ Сервер доступен`);
      } catch (healthError) {
        console.error(`❌ LLM сервер недоступен: ${healthError.message}`);
        console.error(`📡 URL: ${this.baseUrl}`);

        if (healthError.code === 'ECONNREFUSED') {
          console.error(`❌ Не удается подключиться к серверу на ${this.baseUrl}`);
          console.error(`   Убедитесь что:`);
          console.error(`   1. Сервер запущен на порту указанном в LLM_SERVER_URL`);
          console.error(`   2. Нет firewall блокировки`);
          console.error(`   3. Сервер слушает на правильном порту`);
        } else if (healthError.code === 'ENOTFOUND') {
          console.error(`❌ Не удается разрешить адрес сервера`);
          console.error(`   Проверьте настройки LLM_SERVER_URL`);
        } else if (healthError.code === 'ETIMEDOUT') {
          console.error(`❌ Таймаут подключения к серверу`);
          console.error(`   Сервер отвечает слишком медленно или недоступен`);
        }

        throw new Error(`LLM сервер недоступен: ${healthError.message}`);
      }
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: this.requestTimeout
      });

      const llmResponseText = response.data.content || response.data.response || response.data.result || '';
      console.log(`📄 Текст ответа:\n${llmResponseText}\n`);
      
      // Парсим ответ: извлекаем план, соображения или вопросы
      const parsed = this.parsePlanAndConsiderations(llmResponseText);
      
      if (parsed.type === 'plan') {
        console.log(`✅ План создан: ${parsed.steps.length} шагов\n`);
        console.log(`📋 Шаги плана:`);
        parsed.steps.forEach((step, idx) => {
          console.log(`   ${idx + 1}. ${step}`);
        });
        
        if (parsed.considerations) {
          console.log(`\n💡 Соображения ИИ:\n${parsed.considerations}\n`);
        }
      } else if (parsed.type === 'questions') {
        console.log(`❓ Требуются уточнения: ${parsed.questions.length} вопросов\n`);
        console.log(`📋 Вопросы:`);
        parsed.questions.forEach((q, idx) => {
          console.log(`   ${idx + 1}. ${q}`);
        });
      }
      
      return parsed;
    } catch (error) {
      console.error(`\n❌ Ошибка при обращении к LLM: ${error.message}`);
      console.log(`\n⚠️ Использую базовый план вместо LLM\n`);
      
      // Возвращаем базовый план в случае ошибки
      return {
        type: 'plan',
        steps: [
          `Анализ задачи "${taskTitle}"`,
          'Подготовка необходимых ресурсов',
          'Выполнение основных действий',
          'Проверка результатов'
        ],
        considerations: 'Не удалось подключиться к LLM для генерации детального плана.'
      };
    }
  }
  
  /**
   * Генерирует ответы на уточняющие вопросы
   * @param {string} taskTitle - Название задачи
   * @param {Array} questions - Массив вопросов
   * @param {Array} answers - Массив ответов пользователя
   * @returns {Object} - Объект с планом
   */
  async generatePlanFromAnswers(taskTitle, questions, answers) {
    const systemPrompt = `Ты — AI-планировщик задач. Твоя задача: разбить пользовательскую задачу на конкретные, выполнимые шаги И дать свои соображения по выполнению.

ВАЖНО ПРО ФОРМАТ ОТВЕТА:
- Ответ ОБЯЗАТЕЛЬНО должен содержать ДВА раздела: ПЛАН и СООБРАЖЕНИЯ
- Раздел ПЛАН должен начинаться с маркера "ПЛАН:"
- Раздел СООБРАЖЕНИЯ должен начинаться с маркера "СООБРАЖЕНИЯ:"

ТРЕБОВАНИЯ К ПЛАНУ:
- Каждый шаг должен быть чётким и конкретным
- Шагов должно быть от 1 до 10
- Формат СТРОГО: одна строка = один шаг
- НЕ используй нумерацию в шагах, только текст
- Пиши на русском языке
- ВНИМАТЕЛЬНО учитывай ответы пользователя на вопросы

ТРЕБОВАНИЯ К СООБРАЖЕНИЯМ:
- Опиши важные моменты, которые стоит учесть
- Предупреди о потенциальных сложностях
- Дай рекомендации по выполнению
- Учитывай ответы пользователя
- 2-4 предложения`;

    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    
    // Формируем контекст из вопросов и ответов
    const questionsAndAnswers = questions.map((q, idx) => {
      const answer = answers[idx] || 'Нет ответа';
      return `Вопрос: ${q}\nОтвет: ${answer}`;
    }).join('\n\n');
    
    const userPrompt = `Задача: "${fixedTaskTitle}"

Уточняющие вопросы и ответы пользователя:
${questionsAndAnswers}

Теперь, когда есть ответы на вопросы, распиши детальный план выполнения задачи:`;

    try {
      console.log(`\n🧠 Генерирую план на основе ответов пользователя...`);
      console.log(`📡 Подключаюсь к: ${this.baseUrl}/api/send-request`);
      console.log(`📝 Модель: ${this.defaultModel}`);
      
      const requestData = {
        model: this.defaultModel,
        prompt: systemPrompt,
        inputText: userPrompt,
        saveResponse: false
      };
      
      // Проверяем доступность сервера перед отправкой запроса
      try {
        console.log(`🔍 Проверяю доступность сервера...`);
        await axios.get(`${this.baseUrl}`, { timeout: parseInt(process.env.LLM_HEALTH_TIMEOUT) || 2000 });
        console.log(`✅ Сервер доступен`);
      } catch (healthError) {
        console.error(`❌ LLM сервер недоступен: ${healthError.message}`);
        console.error(`📡 URL: ${this.baseUrl}`);

        if (healthError.code === 'ECONNREFUSED') {
          console.error(`❌ Не удается подключиться к серверу на ${this.baseUrl}`);
          console.error(`   Убедитесь что:`);
          console.error(`   1. Сервер запущен на порту указанном в LLM_SERVER_URL`);
          console.error(`   2. Нет firewall блокировки`);
          console.error(`   3. Сервер слушает на правильном порту`);
        } else if (healthError.code === 'ENOTFOUND') {
          console.error(`❌ Не удается разрешить адрес сервера`);
          console.error(`   Проверьте настройки LLM_SERVER_URL`);
        } else if (healthError.code === 'ETIMEDOUT') {
          console.error(`❌ Таймаут подключения к серверу`);
          console.error(`   Сервер отвечает слишком медленно или недоступен`);
        }

        throw new Error(`LLM сервер недоступен: ${healthError.message}`);
      }
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: this.requestTimeout
      });

      const planText = response.data.content || response.data.response || response.data.result || '';
      console.log(`📄 Текст ответа:\n${planText}\n`);
      
      // Парсим ответ: извлекаем план и соображения
      const parsed = this.parsePlanAndConsiderations(planText);
      
      if (parsed.type === 'plan') {
        console.log(`✅ План создан: ${parsed.steps.length} шагов\n`);
        console.log(`📋 Шаги плана:`);
        parsed.steps.forEach((step, idx) => {
          console.log(`   ${idx + 1}. ${step}`);
        });
        
        if (parsed.considerations) {
          console.log(`\n💡 Соображения ИИ:\n${parsed.considerations}\n`);
        }
      }
      
      return parsed;
    } catch (error) {
      console.error(`\n❌ Ошибка при обращении к LLM: ${error.message}`);
      console.log(`\n⚠️ Использую базовый план вместо LLM\n`);
      
      // Возвращаем базовый план в случае ошибки
      return {
        type: 'plan',
        steps: [
          `Анализ задачи "${taskTitle}"`,
          'Подготовка необходимых ресурсов',
          'Выполнение основных действий',
          'Проверка результатов'
        ],
        considerations: 'Не удалось подключиться к LLM для генерации детального плана.'
      };
    }
  }

  /**
   * Генерирует соображения для конкретного шага
   * @param {string} stepTitle - Название шага
   * @param {string} taskTitle - Название родительской задачи
   * @returns {string} - Соображения о выполнении шага
   */
  async generateStepConsiderations(stepTitle, taskTitle) {
    const systemPrompt = `Ты — AI-помощник для планирования задач. Твоя задача: дать конкретные соображения по выполнению шага задачи.

ВАЖНО:
- Опиши что именно нужно сделать в этом шаге
- Дай конкретные команды или действия, если применимо
- Укажи на важные моменты и потенциальные проблемы
- Будь максимально практичным и конкретным
- 2-5 предложений
- Пиши на русском языке`;

    const fixedStepTitle = fixRussianEncoding(stepTitle);
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    
    const userPrompt = `Задача: "${fixedTaskTitle}"
Шаг: "${fixedStepTitle}"

Дай соображения и рекомендации по выполнению этого шага:`;

    try {
      console.log(`\n💡 Генерирую соображения для шага: "${stepTitle}"...`);
      
      const requestData = {
        model: this.defaultModel,
        prompt: systemPrompt,
        inputText: userPrompt,
        saveResponse: false
      };
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: this.requestTimeout
      });

      const considerationsText = response.data.content || response.data.response || response.data.result || '';
      
      // Берем только первые несколько предложений (обрезаем если слишком длинное)
      let considerations = considerationsText.trim();
      const sentences = considerations.split(/[.!?]\s+/);
      if (sentences.length > 5) {
        considerations = sentences.slice(0, 5).join('. ') + '.';
      }
      
      return considerations || 'Выполнить данный шаг согласно требованиям задачи.';
    } catch (error) {
      console.error(`\n⚠️ Ошибка при генерации соображений для шага: ${error.message}`);
      return 'Выполнить данный шаг согласно требованиям задачи.';
    }
  }
}

module.exports = LLMClient;

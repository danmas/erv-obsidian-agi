const axios = require('axios');
const { fixRussianEncoding } = require('./fix-encoding');

class LLMClient {
  constructor() {
    this.baseUrl = process.env.LLM_SERVER_URL || 'http://usa:3002';
    this.defaultModel = process.env.LLM_MODEL || 'FAST';
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
        await axios.get(`${this.baseUrl}`, { timeout: 2000 });
        console.log(`✅ Сервер доступен`);
      } catch (healthError) {
        console.error(`❌ Сервер недоступен: ${healthError.message}`);
        throw new Error(`LLM сервер недоступен: ${healthError.message}`);
      }
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: 30000 // 30 секунд таймаут
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
   * Парсит ответ LLM, извлекая план и соображения
   * @param {string} text - Текст ответа от LLM
   * @returns {Object} - Объект с массивом steps и строкой considerations
   */
  parsePlanAndConsiderations(text) {
    let planSection = '';
    let considerationsSection = '';
    
    // Ищем секции ПЛАН: и СООБРАЖЕНИЯ:
    const planMatch = text.match(/ПЛАН:\s*([\s\S]*?)(?=СООБРАЖЕНИЯ:|$)/i);
    const considerationsMatch = text.match(/СООБРАЖЕНИЯ:\s*([\s\S]*?)$/i);
    
    if (planMatch) {
      planSection = planMatch[1].trim();
    } else {
      // Если маркер ПЛАН: не найден, используем весь текст до СООБРАЖЕНИЯ:
      const beforeConsiderations = text.split(/СООБРАЖЕНИЯ:/i)[0];
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
        timeout: 30000
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
   * Генерирует план задачи с учетом контекста пользователя
   * @param {string} taskTitle - Название задачи
   * @param {string} userContext - Соображения и контекст от пользователя
   * @returns {Array} - Массив шагов
   */
  async generateTaskPlanWithContext(taskTitle, userContext) {
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
- ВНИМАТЕЛЬНО учитывай контекст и соображения пользователя при планировании

ТРЕБОВАНИЯ К СООБРАЖЕНИЯМ:
- Опиши важные моменты, которые стоит учесть
- Предупреди о потенциальных сложностях
- Дай рекомендации по выполнению
- Учитывай соображения пользователя и дополняй их своими
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

    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    const fixedUserContext = fixRussianEncoding(userContext);
    
    const userPrompt = `Задача: "${fixedTaskTitle}"

Контекст и соображения пользователя:
${fixedUserContext}

Распиши план выполнения этой задачи с учетом контекста:`;

    try {
      console.log(`\n🧠 Генерирую план для задачи с учетом контекста пользователя...`);
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
        await axios.get(`${this.baseUrl}`, { timeout: 2000 });
        console.log(`✅ Сервер доступен`);
      } catch (healthError) {
        console.error(`❌ Сервер недоступен: ${healthError.message}`);
        throw new Error(`LLM сервер недоступен: ${healthError.message}`);
      }
      
      const response = await axios.post(`${this.baseUrl}/api/send-request`, requestData, {
        timeout: 30000 // 30 секунд таймаут
      });

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
        timeout: 20000 // 20 секунд таймаут
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

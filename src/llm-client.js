const axios = require('axios');
const { fixRussianEncoding } = require('./fix-encoding');

class LLMClient {
  constructor() {
    this.baseUrl = process.env.LLM_SERVER_URL || 'http://usa:3002';
    this.defaultModel = process.env.LLM_MODEL || 'FAST';
  }

  async generateTaskPlan(taskTitle) {
    const systemPrompt = `Ты — AI-планировщик задач. Твоя задача: разбить пользовательскую задачу на конкретные, выполнимые шаги.

ВАЖНО:
- Каждый шаг должен быть чётким и конкретным
- Шагов должно быть от 3 до 7
- Формат СТРОГО: одна строка = один шаг
- НЕ используй нумерацию, только текст шага
- Пиши на русском языке

Пример для задачи "Настроить Docker для проекта":
Установить Docker Desktop на Windows
Создать Dockerfile для приложения
Написать docker-compose.yml с настройками
Собрать образ и запустить контейнер
Проверить работоспособность приложения в контейнере`;

    // Исправляем кодировку в названии задачи
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    
    const userPrompt = `Задача: "${fixedTaskTitle}"

Распиши план выполнения этой задачи:`;

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
      console.log(`📄 Текст плана:\n${planText}\n`);
      
      // Парсим ответ модели в массив шагов
      let lines = planText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
      
      // Если ответ слишком длинный (больше 20 строк), берем только последние 10 строк,
      // которые, скорее всего, содержат финальный план
      if (lines.length > 20) {
        console.log(`⚠️ Ответ LLM слишком длинный (${lines.length} строк), беру последние 10 строк`);
        
        // Ищем последний блок с русским текстом (скорее всего, это финальный план)
        let russianBlockIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (/[а-яА-ЯёЁ]/.test(lines[i])) {
            russianBlockIndex = i;
            // Ищем начало этого блока (пустая строка или строка без русских символов)
            while (russianBlockIndex > 0 && 
                  (/[а-яА-ЯёЁ]/.test(lines[russianBlockIndex - 1]) || lines[russianBlockIndex - 1] === '')) {
              russianBlockIndex--;
            }
            break;
          }
        }
        
        if (russianBlockIndex !== -1) {
          console.log(`✅ Найден блок с русским текстом, начиная со строки ${russianBlockIndex}`);
          lines = lines.slice(russianBlockIndex);
        } else {
          // Если русский текст не найден, берем последние 10 строк
          console.log(`⚠️ Блок с русским текстом не найден, беру последние 10 строк`);
          lines = lines.slice(-10);
        }
      }
      
      // Обрабатываем строки
      const steps = lines
        .map(line => {
          // Убираем возможную нумерацию типа "1.", "1)", "- "
          return line.replace(/^\d+[\.\)\]]\s*/, '').replace(/^[\-\*]\s*/, '').trim();
        })
        .filter(line => line.length > 10) // Фильтруем слишком короткие строки
        .filter(line => !/^Project setup|^Layer \d|^These steps|^The framework|^But |^In conclusion,/.test(line)); // Фильтруем строки с метаданными

      console.log(`✅ План создан: ${steps.length} шагов\n`);
      console.log(`📋 Шаги плана:`);
      steps.forEach((step, idx) => {
        console.log(`   ${idx + 1}. ${step}`);
      });
      
      return steps;
    } catch (error) {
      console.error(`\n❌ Ошибка при обращении к LLM: ${error.message}`);
      console.error(`🔍 Детали ошибки:`, error);
      console.log(`\n⚠️ Использую базовый план вместо LLM\n`);
      
      // Возвращаем базовый план в случае ошибки
      return [
        `Анализ задачи "${taskTitle}"`,
        'Подготовка необходимых ресурсов',
        'Выполнение основных действий',
        'Проверка результатов'
      ];
    }
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
- Шагов должно быть от 3 до 5
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
}

module.exports = LLMClient;

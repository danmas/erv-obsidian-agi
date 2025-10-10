const { fixRussianEncoding, sanitizeFilename } = require('./fix-encoding');
const { parseChecklist, parseFrontmatter, extractTaskTitle } = require('./note-parser');

class TaskManager {
  constructor(obsidianClient, llmClient = null) {
    this.client = obsidianClient;
    this.llm = llmClient;
  }

  generateTaskId() {
    const now = new Date();
    return `task-${now.toISOString().split('T')[0]}-${Date.now().toString().slice(-6)}`;
  }

  createTaskNote(taskTitle, steps, considerations = null) {
    const taskId = this.generateTaskId();
    const created = new Date().toISOString();
    
    // Исправляем кодировку и санитизируем для названия файла
    const fixedTitle = fixRussianEncoding(taskTitle);
    const safeFilename = sanitizeFilename(fixedTitle);
    
    const frontmatter = `---
task_id: ${taskId}
status: pending
created: ${created}
parent: null
---`;

    // Добавляем префиксы "Шаг N:" к каждому шагу и санитизируем для создания валидных ссылок
    const stepsList = steps.map((step, idx) => {
      const cleanStep = sanitizeFilename(fixRussianEncoding(step));
      return `- [ ] [[Шаг ${idx + 1} ${cleanStep}]]`;
    }).join('\n');
    
    // Добавляем секцию с соображениями ИИ если они есть
    const considerationsSection = considerations 
      ? `\n## 🧠 Соображения ИИ:\n\n${considerations}\n` 
      : '';

    const content = `${frontmatter}

# 🎯 Задача: ${fixedTitle}
${considerationsSection}
## План выполнения:

${stepsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Статус:** В ожидании
`;

    return { taskId, content, path: `AGI-Tasks/${safeFilename}.md`, steps, safeFilename };
  }

  async createTask(taskTitle, steps = null) {
    // Исправляем кодировку в названии задачи
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    
    console.log(`\n🚀 Создаю задачу: "${fixedTaskTitle}"\n`);
    
    // Если шаги не переданы и есть LLM - генерируем план
    let taskSteps = steps;
    let considerations = null;
    
    if (!taskSteps && this.llm) {
      const llmResult = await this.llm.generateTaskPlan(fixedTaskTitle);
      taskSteps = llmResult.steps;
      considerations = llmResult.considerations;
    }
    
    // Если всё ещё нет шагов - используем дефолтные
    if (!taskSteps || taskSteps.length === 0) {
      taskSteps = [
        `Анализ задачи "${fixedTaskTitle}"`,
        'Подготовка необходимых ресурсов',
        'Выполнение основных действий',
        'Проверка результатов'
      ];
    }
    
    // Исправляем кодировку в шагах
    const fixedTaskSteps = taskSteps.map(step => fixRussianEncoding(step));
    
    // Исправляем кодировку в соображениях если они есть
    const fixedConsiderations = considerations ? fixRussianEncoding(considerations) : null;
    
    const task = this.createTaskNote(fixedTaskTitle, fixedTaskSteps, fixedConsiderations);
    await this.client.createNote(task.path, task.content);
    
    console.log(`\n📋 План:`);
    fixedTaskSteps.forEach((step, idx) => {
      console.log(`   ${idx + 1}. ${step}`);
    });
    
    console.log(`\n✨ Задача создана в Obsidian: ${task.path}\n`);
    
    // Создаем заметки для каждого шага
    console.log(`\n📝 Создаю заметки для шагов...`);
    await this.createStepNotes(fixedTaskTitle, fixedTaskSteps);
    
    return task;
  }

  /**
   * Создает заметки для всех шагов задачи
   * @param {string} taskTitle - Название задачи
   * @param {Array} steps - Массив шагов
   */
  async createStepNotes(taskTitle, steps) {
    for (let i = 0; i < steps.length; i++) {
      const stepNumber = i + 1;
      const stepTitle = steps[i];
      
      // Очищаем название шага от команд и спецсимволов
      const cleanStepTitle = sanitizeFilename(fixRussianEncoding(stepTitle));
      const stepWithPrefix = `Шаг ${stepNumber} ${cleanStepTitle}`;
      
      try {
        // Генерируем соображения для шага (используем оригинальный stepTitle для контекста)
        let stepConsiderations = 'Выполнить данный шаг согласно требованиям задачи.';
        if (this.llm) {
          stepConsiderations = await this.llm.generateStepConsiderations(stepTitle, taskTitle);
        }
        
        // Санитизируем имя файла (уже очищено, но на всякий случай)
        const safeStepFilename = stepWithPrefix;
        
        // Создаем содержимое заметки для шага
        const stepContent = `---
step_number: ${stepNumber}
parent_task: ${taskTitle}
status: pending
---

# ${stepWithPrefix}

## 🧠 Соображения ИИ:

${stepConsiderations}

## ✅ Критерии выполнения:

- [ ] Шаг выполнен согласно плану
- [ ] Результат проверен

---
**Родительская задача:** ${taskTitle}
`;
        
        const stepPath = `AGI-Tasks/${safeStepFilename}.md`;
        await this.client.createNote(stepPath, stepContent);
        
        console.log(`   ✓ Создана заметка для шага ${stepNumber}: ${safeStepFilename}.md`);
      } catch (error) {
        console.error(`   ✗ Ошибка при создании заметки для шага ${stepNumber}: ${error.message}`);
      }
    }
    console.log(`\n✨ Все заметки для шагов созданы\n`);
  }

  /**
   * Создает подзадачу на основе шага из родительской задачи
   * @param {string} parentTaskPath - Путь к родительской задаче
   * @param {number} stepIndex - Индекс шага (начиная с 0)
   * @returns {Object} - Созданная подзадача
   */
  async createSubtask(parentTaskPath, stepIndex) {
    console.log(`\n🔍 Читаю родительскую задачу: ${parentTaskPath}\n`);
    
    // Читаем родительскую заметку
    const parentContent = await this.client.readNote(parentTaskPath);
    
    // Парсим чек-лист
    const checklistItems = parseChecklist(parentContent);
    
    if (stepIndex >= checklistItems.length) {
      throw new Error(`Шаг с индексом ${stepIndex} не найден. Всего шагов: ${checklistItems.length}`);
    }
    
    const step = checklistItems[stepIndex];
    
    if (step.completed) {
      console.log(`⚠️ Шаг "${step.title}" уже выполнен`);
      return null;
    }
    
    console.log(`📌 Создаю подзадачу для шага: "${step.title}"\n`);
    
    // Получаем метаданные родительской задачи
    const parentMetadata = parseFrontmatter(parentContent);
    const parentTaskTitle = extractTaskTitle(parentContent);
    
    // Генерируем детальный план для подзадачи
    let subtaskSteps = null;
    if (this.llm) {
      subtaskSteps = await this.llm.generateSubtaskPlan(step.title, parentTaskTitle);
    }
    
    // Если LLM не вернул план, используем базовый
    if (!subtaskSteps || subtaskSteps.length === 0) {
      subtaskSteps = [
        `Изучить требования для "${step.title}"`,
        'Подготовить необходимые ресурсы и инструменты',
        'Выполнить основную работу',
        'Проверить результат и задокументировать'
      ];
    }
    
    // Создаем заметку для подзадачи
    const subtask = this.createSubtaskNote(
      step.title,
      subtaskSteps,
      parentTaskPath,
      parentMetadata.task_id
    );
    
    await this.client.createNote(subtask.path, subtask.content);
    
    console.log(`\n📋 План подзадачи:`);
    subtaskSteps.forEach((s, idx) => {
      console.log(`   ${idx + 1}. ${s}`);
    });
    
    console.log(`\n✨ Подзадача создана в Obsidian: ${subtask.path}\n`);
    
    return subtask;
  }

  /**
   * Создает содержимое заметки для подзадачи
   * @param {string} subtaskTitle - Название подзадачи
   * @param {Array} steps - Шаги подзадачи
   * @param {string} parentTaskPath - Путь к родительской задаче
   * @param {string} parentTaskId - ID родительской задачи
   * @returns {Object} - Объект с содержимым и путем к заметке
   */
  createSubtaskNote(subtaskTitle, steps, parentTaskPath, parentTaskId) {
    const taskId = this.generateTaskId();
    const created = new Date().toISOString();
    
    // Исправляем кодировку для названия файла
    const fixedTitle = fixRussianEncoding(subtaskTitle);
    
    const frontmatter = `---
task_id: ${taskId}
status: pending
created: ${created}
parent: ${parentTaskId}
parent_path: ${parentTaskPath}
---`;

    const stepsList = steps.map(step => `- [ ] ${step}`).join('\n');

    const content = `${frontmatter}

# 📋 Подзадача: ${fixedTitle}

**Родительская задача:** [[${parentTaskPath}]]

## План выполнения:

${stepsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Статус:** В ожидании
`;

    return { taskId, content, path: `AGI-Tasks/${fixedTitle}.md` };
  }

  /**
   * Создает задачу из черновика в Obsidian
   * @param {string} draftPath - Путь к черновику
   * @returns {Object} - Созданная задача или объект с вопросами
   */
  async createTaskFromDraft(draftPath) {
    console.log(`\n📖 Читаю черновик: ${draftPath}\n`);
    
    // Читаем черновик
    const draftContent = await this.client.readNote(draftPath);
    
    // Извлекаем заголовок (если есть)
    const titleMatch = draftContent.match(/^#\s+(.+)/m);
    const taskTitle = titleMatch ? titleMatch[1] : 'Задача из черновика';
    
    console.log(`\n🚀 Анализирую задачу из черновика: "${taskTitle}"\n`);
    
    // Удаляем фронтматтер если есть (чтобы не было конфликта)
    let userContext = draftContent.replace(/^---[\s\S]*?---\n/, '').trim();
    
    // Проверяем, есть ли в черновике уже ответы на вопросы
    const answersSection = this.extractAnswersFromDraft(draftContent);
    
    if (answersSection && answersSection.questions && answersSection.answers) {
      // Если есть ответы на вопросы, генерируем план на их основе
      console.log(`\n✅ Найдены ответы на уточняющие вопросы. Генерирую план...`);
      
      const llmResult = await this.llm.generatePlanFromAnswers(
        taskTitle, 
        answersSection.questions, 
        answersSection.answers
      );
      
      if (llmResult.type === 'plan') {
        // Создаем задачу на основе плана
        const fixedTaskTitle = fixRussianEncoding(taskTitle);
        const fixedTaskSteps = llmResult.steps.map(step => fixRussianEncoding(step));
        const fixedConsiderations = llmResult.considerations ? fixRussianEncoding(llmResult.considerations) : null;
        
        // Создаем новое содержимое задачи, сохраняя историю вопросов и ответов
        const task = this.createTaskNoteWithQA(
          fixedTaskTitle, 
          fixedTaskSteps, 
          userContext,
          fixedConsiderations,
          answersSection.questions,
          answersSection.answers
        );
        
        // Обновляем существующую заметку
        await this.client.updateNote(draftPath, task.content);
        
        console.log(`\n📋 План:`);
        fixedTaskSteps.forEach((step, idx) => {
          console.log(`   ${idx + 1}. ${step}`);
        });
        
        console.log(`\n✨ Черновик преобразован в задачу: ${draftPath}\n`);
        
        // Создаем заметки для каждого шага
        console.log(`\n📝 Создаю заметки для шагов...`);
        await this.createStepNotes(fixedTaskTitle, fixedTaskSteps);
        
        return task;
      }
    } else {
      // Если нет ответов, генерируем план или вопросы
      if (this.llm) {
        const llmResult = await this.llm.generateTaskPlanWithContext(taskTitle, userContext);
        
        if (llmResult.type === 'questions') {
          // Если LLM вернул вопросы, создаем заметку с вопросами
          console.log(`\n❓ Задача требует уточнений. Создаю заметку с вопросами...`);
          
          const questionsNote = this.createQuestionsNote(
            taskTitle,
            llmResult.questions,
            userContext
          );
          
          // Обновляем существующую заметку
          await this.client.updateNote(draftPath, questionsNote.content);
          
          console.log(`\n✨ Черновик преобразован в заметку с вопросами: ${draftPath}`);
          console.log(`\n📝 Ответьте на вопросы в заметке и запустите скрипт снова с тем же путем.`);
          
          return { type: 'questions', path: draftPath, questions: llmResult.questions };
        } else if (llmResult.type === 'plan') {
          // Если LLM вернул план, создаем задачу
          const fixedTaskTitle = fixRussianEncoding(taskTitle);
          const fixedTaskSteps = llmResult.steps.map(step => fixRussianEncoding(step));
          const fixedConsiderations = llmResult.considerations ? fixRussianEncoding(llmResult.considerations) : null;
          
          // Создаем новое содержимое задачи
          const task = this.createTaskNoteWithContext(
            fixedTaskTitle, 
            fixedTaskSteps, 
            userContext,
            fixedConsiderations
          );
          
          // Обновляем существующую заметку
          await this.client.updateNote(draftPath, task.content);
          
          console.log(`\n📋 План:`);
          fixedTaskSteps.forEach((step, idx) => {
            console.log(`   ${idx + 1}. ${step}`);
          });
          
          console.log(`\n✨ Черновик преобразован в задачу: ${draftPath}\n`);
          
          // Создаем заметки для каждого шага
          console.log(`\n📝 Создаю заметки для шагов...`);
          await this.createStepNotes(fixedTaskTitle, fixedTaskSteps);
          
          return task;
        }
      }
    }
    
    // Если LLM не доступен или не вернул ни плана, ни вопросов - используем дефолтные шаги
    const taskSteps = [
      `Анализ задачи "${taskTitle}"`,
      'Подготовка необходимых ресурсов',
      'Выполнение основных действий',
      'Проверка результатов'
    ];
    
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    const fixedTaskSteps = taskSteps.map(step => fixRussianEncoding(step));
    
    // Создаем новое содержимое задачи
    const task = this.createTaskNoteWithContext(
      fixedTaskTitle, 
      fixedTaskSteps, 
      userContext,
      null
    );
    
    // Обновляем существующую заметку
    await this.client.updateNote(draftPath, task.content);
    
    console.log(`\n📋 План (базовый):`);
    fixedTaskSteps.forEach((step, idx) => {
      console.log(`   ${idx + 1}. ${step}`);
    });
    
    console.log(`\n✨ Черновик преобразован в задачу: ${draftPath}\n`);
    
    // Создаем заметки для каждого шага
    console.log(`\n📝 Создаю заметки для шагов...`);
    await this.createStepNotes(fixedTaskTitle, fixedTaskSteps);
    
    return task;
  }
  
  /**
   * Извлекает вопросы и ответы из черновика
   * @param {string} content - Содержимое черновика
   * @returns {Object|null} - Объект с вопросами и ответами или null
   */
  extractAnswersFromDraft(content) {
    // Ищем секцию с вопросами и ответами
    const qaMatch = content.match(/## Уточняющие вопросы:\s*([\s\S]*?)(?=##|$)/i);
    
    if (!qaMatch) return null;
    
    const qaSection = qaMatch[1].trim();
    const qaLines = qaSection.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const questions = [];
    const answers = [];
    
    // Парсим вопросы и ответы
    let currentQuestion = null;
    
    for (const line of qaLines) {
      // Если строка начинается с "Вопрос:" или "1.", "2." и т.д. - это вопрос
      if (line.startsWith('Вопрос:') || /^\d+\.\s+/.test(line)) {
        // Если был предыдущий вопрос без ответа, добавляем пустой ответ
        if (currentQuestion !== null) {
          answers.push('');
        }
        
        // Извлекаем текст вопроса
        const questionText = line.replace(/^Вопрос:\s*/, '').replace(/^\d+\.\s+/, '').trim();
        questions.push(questionText);
        currentQuestion = questionText;
      }
      // Если строка начинается с "Ответ:" - это ответ
      else if (line.startsWith('Ответ:')) {
        const answerText = line.replace(/^Ответ:\s*/, '').trim();
        
        if (currentQuestion !== null) {
          answers.push(answerText);
          currentQuestion = null;
        }
      }
      // Если есть текущий вопрос и строка не пустая - считаем это ответом
      else if (currentQuestion !== null && !line.startsWith('-') && !line.startsWith('*')) {
        answers.push(line);
        currentQuestion = null;
      }
    }
    
    // Если остался вопрос без ответа, добавляем пустой ответ
    if (currentQuestion !== null) {
      answers.push('');
    }
    
    // Если нашли хотя бы один вопрос с ответом
    if (questions.length > 0 && answers.length > 0 && questions.length === answers.length) {
      return { questions, answers };
    }
    
    return null;
  }
  
  /**
   * Создает заметку с уточняющими вопросами
   * @param {string} taskTitle - Название задачи
   * @param {Array} questions - Массив вопросов
   * @param {string} userContext - Исходные соображения пользователя
   * @returns {Object} - Объект с содержимым заметки
   */
  createQuestionsNote(taskTitle, questions, userContext) {
    const created = new Date().toISOString();
    
    const frontmatter = `---
status: questions
created: ${created}
---`;

    // Форматируем вопросы в виде списка
    const questionsList = questions.map((q, idx) => `${idx + 1}. ${q}\nОтвет: `).join('\n\n');

    const content = `${frontmatter}

# ❓ Уточняющие вопросы: ${taskTitle}

## Исходные соображения пользователя:

${userContext}

## Уточняющие вопросы:

${questionsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Инструкция:** Ответьте на вопросы выше и запустите скрипт снова с тем же путем к заметке.
`;

    return { content };
  }
  
  /**
   * Создает содержимое заметки с вопросами и ответами
   * @param {string} taskTitle - Название задачи
   * @param {Array} steps - Шаги выполнения
   * @param {string} userContext - Исходные соображения пользователя
   * @param {string} considerations - Соображения ИИ
   * @param {Array} questions - Массив вопросов
   * @param {Array} answers - Массив ответов
   * @returns {Object} - Объект с содержимым задачи
   */
  createTaskNoteWithQA(taskTitle, steps, userContext, considerations = null, questions = [], answers = []) {
    const taskId = this.generateTaskId();
    const created = new Date().toISOString();
    
    const frontmatter = `---
task_id: ${taskId}
status: pending
created: ${created}
parent: null
---`;

    // Добавляем префиксы "Шаг N:" к каждому шагу и санитизируем для создания валидных ссылок
    const stepsList = steps.map((step, idx) => {
      const cleanStep = sanitizeFilename(fixRussianEncoding(step));
      return `- [ ] [[Шаг ${idx + 1} ${cleanStep}]]`;
    }).join('\n');
    
    // Добавляем секцию с соображениями ИИ если они есть
    const considerationsSection = considerations 
      ? `\n## 🧠 Соображения ИИ:\n\n${considerations}\n` 
      : '';
    
    // Форматируем вопросы и ответы
    const qaSection = questions.length > 0 
      ? `\n## 🔍 Уточняющие вопросы и ответы:\n\n${questions.map((q, idx) => `**Вопрос ${idx + 1}:** ${q}\n**Ответ:** ${answers[idx] || 'Нет ответа'}`).join('\n\n')}\n` 
      : '';

    const content = `${frontmatter}

# 🎯 Задача: ${taskTitle}

## 📝 Исходные соображения пользователя:

${userContext}
${qaSection}${considerationsSection}
## План выполнения:

${stepsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Статус:** В ожидании
`;

    return { taskId, content, steps };
  }

  /**
   * Создает содержимое заметки с контекстом пользователя
   * @param {string} taskTitle - Название задачи
   * @param {Array} steps - Шаги выполнения
   * @param {string} userContext - Исходные соображения пользователя
   * @param {string} considerations - Соображения ИИ
   * @returns {Object} - Объект с содержимым задачи
   */
  createTaskNoteWithContext(taskTitle, steps, userContext, considerations = null) {
    const taskId = this.generateTaskId();
    const created = new Date().toISOString();
    
    const frontmatter = `---
task_id: ${taskId}
status: pending
created: ${created}
parent: null
---`;

    // Добавляем префиксы "Шаг N:" к каждому шагу и санитизируем для создания валидных ссылок
    const stepsList = steps.map((step, idx) => {
      const cleanStep = sanitizeFilename(fixRussianEncoding(step));
      return `- [ ] [[Шаг ${idx + 1} ${cleanStep}]]`;
    }).join('\n');
    
    // Добавляем секцию с соображениями ИИ если они есть
    const considerationsSection = considerations 
      ? `\n## 🧠 Соображения ИИ:\n\n${considerations}\n` 
      : '';

    const content = `${frontmatter}

# 🎯 Задача: ${taskTitle}

## 📝 Исходные соображения пользователя:

${userContext}
${considerationsSection}
## План выполнения:

${stepsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Статус:** В ожидании
`;

    return { taskId, content, steps };
  }
}

module.exports = TaskManager;

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
   * @returns {Object} - Созданная задача
   */
  async createTaskFromDraft(draftPath) {
    console.log(`\n📖 Читаю черновик: ${draftPath}\n`);
    
    // Читаем черновик
    const draftContent = await this.client.readNote(draftPath);
    
    // Извлекаем заголовок (если есть)
    const titleMatch = draftContent.match(/^#\s+(.+)/m);
    const taskTitle = titleMatch ? titleMatch[1] : 'Задача из черновика';
    
    console.log(`\n🚀 Создаю задачу на основе черновика: "${taskTitle}"\n`);
    
    // Удаляем фронтматтер если есть (чтобы не было конфликта)
    let userContext = draftContent.replace(/^---[\s\S]*?---\n/, '').trim();
    
    // Генерируем план через LLM с учетом контекста
    let taskSteps = [];
    let considerations = null;
    
    if (this.llm) {
      const llmResult = await this.llm.generateTaskPlanWithContext(taskTitle, userContext);
      taskSteps = llmResult.steps;
      considerations = llmResult.considerations;
    }
    
    // Если LLM не вернул план - используем дефолтные шаги
    if (!taskSteps || taskSteps.length === 0) {
      taskSteps = [
        `Анализ задачи "${taskTitle}"`,
        'Подготовка необходимых ресурсов',
        'Выполнение основных действий',
        'Проверка результатов'
      ];
    }
    
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    const fixedTaskSteps = taskSteps.map(step => fixRussianEncoding(step));
    
    // Исправляем кодировку в соображениях если они есть
    const fixedConsiderations = considerations ? fixRussianEncoding(considerations) : null;
    
    // Создаем новое содержимое задачи
    const task = this.createTaskNoteWithContext(
      fixedTaskTitle, 
      fixedTaskSteps, 
      userContext,
      fixedConsiderations
    );
    
    // ВАЖНО: обновляем существующую заметку, а не создаем новую
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

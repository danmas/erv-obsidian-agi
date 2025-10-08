const { fixRussianEncoding } = require('./fix-encoding');
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

  createTaskNote(taskTitle, steps) {
    const taskId = this.generateTaskId();
    const created = new Date().toISOString();
    
    // Исправляем кодировку для названия файла
    const fixedTitle = fixRussianEncoding(taskTitle);
    
    const frontmatter = `---
task_id: ${taskId}
status: pending
created: ${created}
parent: null
---`;

    const stepsList = steps.map(step => `- [ ] [[${step}]]`).join('\n');

    const content = `${frontmatter}

# 🎯 Задача: ${fixedTitle}

## План выполнения:

${stepsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Статус:** В ожидании
`;

    return { taskId, content, path: `AGI-Tasks/${fixedTitle}.md` };
  }

  async createTask(taskTitle, steps = null) {
    // Исправляем кодировку в названии задачи
    const fixedTaskTitle = fixRussianEncoding(taskTitle);
    
    console.log(`\n🚀 Создаю задачу: "${fixedTaskTitle}"\n`);
    
    // Если шаги не переданы и есть LLM - генерируем план
    let taskSteps = steps;
    if (!taskSteps && this.llm) {
      taskSteps = await this.llm.generateTaskPlan(fixedTaskTitle);
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
    
    const task = this.createTaskNote(fixedTaskTitle, fixedTaskSteps);
    await this.client.createNote(task.path, task.content);
    
    console.log(`\n📋 План:`);
    fixedTaskSteps.forEach((step, idx) => {
      console.log(`   ${idx + 1}. ${step}`);
    });
    
    console.log(`\n✨ Задача создана в Obsidian: ${task.path}\n`);
    return task;
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
}

module.exports = TaskManager;

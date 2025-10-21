require('dotenv').config();
const ObsidianClient = require('./src/obsidian-client');
const TaskManager = require('./src/task-manager');
const LLMClient = require('./src/llm-client');

async function main() {
  // Получаем путь к задаче и номер шага из аргументов командной строки
  const taskPath = process.argv[2];
  const stepNumber = parseInt(process.argv[3]);
  
  if (!taskPath || isNaN(stepNumber)) {
    console.log('❌ Использование: node expand-step.js "AGI-Tasks/Задача.md" 1');
    console.log('   где 1 - номер шага (начиная с 1)');
    process.exit(1);
  }
  
  // Преобразуем номер шага в индекс (индексация в массиве начинается с 0)
  const stepIndex = stepNumber - 1;

  const obsidian = new ObsidianClient();
  const llm = new LLMClient();
  const taskManager = new TaskManager(obsidian, llm);

  try {
    // Создаем подзадачу
    const subtask = await taskManager.createSubtask(taskPath, stepIndex);
    
    if (!subtask) {
      console.log('⚠️ Подзадача не была создана (возможно, шаг уже выполнен)');
      process.exit(0);
    }
    
    console.log('🎉 Подзадача успешно создана!');
    console.log(`📂 Путь: ${subtask.path}`);
    console.log(`🆔 ID: ${subtask.taskId}`);
  } catch (error) {
    console.error('❌ Ошибка при создании подзадачи:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

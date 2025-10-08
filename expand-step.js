require('dotenv').config();
const ObsidianClient = require('./src/obsidian-client');
const TaskManager = require('./src/task-manager');
const LLMClient = require('./src/llm-client');

async function main() {
  // Получаем путь к задаче и индекс шага из аргументов командной строки
  const taskPath = process.argv[2];
  const stepIndex = parseInt(process.argv[3]);
  
  if (!taskPath || isNaN(stepIndex)) {
    console.log('❌ Использование: node expand-step.js "AGI-Tasks/Задача.md" 0');
    console.log('   где 0 - индекс шага (начиная с 0)');
    process.exit(1);
  }

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

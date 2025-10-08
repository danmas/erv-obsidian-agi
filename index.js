require('dotenv').config();
const ObsidianClient = require('./src/obsidian-client');
const TaskManager = require('./src/task-manager');
const LLMClient = require('./src/llm-client');

async function main() {
  // Получаем задачу из аргументов командной строки
  const taskTitle = process.argv[2];
  
  if (!taskTitle) {
    console.log('❌ Укажите задачу: node index.js "Название задачи"');
    process.exit(1);
  }

  const obsidian = new ObsidianClient();
  const llm = new LLMClient();
  const taskManager = new TaskManager(obsidian, llm);

  // Теперь план генерируется автоматически через LLM
  await taskManager.createTask(taskTitle);
}

main().catch(console.error);

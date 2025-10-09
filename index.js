require('dotenv').config();
const ObsidianClient = require('./src/obsidian-client');
const TaskManager = require('./src/task-manager');
const LLMClient = require('./src/llm-client');

async function main() {
  const args = process.argv.slice(2);
  
  // Проверяем флаг --from-obsidian
  const fromObsidianIndex = args.indexOf('--from-obsidian');
  
  if (fromObsidianIndex !== -1) {
    // Режим создания задачи из черновика
    const draftPath = args[fromObsidianIndex + 1];
    
    if (!draftPath) {
      console.log('❌ Укажите путь к черновику: node index.js --from-obsidian "AGI-Tasks/Черновик.md"');
      process.exit(1);
    }
    
    const obsidian = new ObsidianClient();
    const llm = new LLMClient();
    const taskManager = new TaskManager(obsidian, llm);
    
    await taskManager.createTaskFromDraft(draftPath);
  } else {
    // Обычный режим
    const taskTitle = args[0];
    
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
}

main().catch(console.error);

require('dotenv').config();
const axios = require('axios');
const ObsidianClient = require('./src/obsidian-client');
const TaskManager = require('./src/task-manager');
const LLMClient = require('./src/llm-client');

async function main() {
  const args = process.argv.slice(2);

  // Проверяем подключения к серверам перед запуском
  console.log('\n🔍 Проверка подключений к серверам...\n');

  let allConnectionsOk = true;

  // Проверяем подключение к Obsidian
  const obsidian = new ObsidianClient();
  const obsidianOk = await obsidian.checkConnection();
  if (!obsidianOk) {
    allConnectionsOk = false;
    console.error('❌ Не удается подключиться к Obsidian серверу');
  }

  // Проверяем подключение к LLM серверу
  const llm = new LLMClient();
  try {
    console.log(`🔍 Проверяю доступность LLM сервера...`);
    console.log(`📡 Подключаюсь к: ${llm.baseUrl}`);

    await axios.get(`${llm.baseUrl}`, {
      timeout: parseInt(process.env.LLM_HEALTH_TIMEOUT) || 2000
    });

    console.log(`✅ LLM сервер доступен`);
  } catch (error) {
    allConnectionsOk = false;
    console.error(`❌ LLM сервер недоступен: ${error.message}`);
    console.error(`📡 URL: ${llm.baseUrl}`);
  }

  if (allConnectionsOk) {
    console.log('✅ Все серверы доступны\n');
  } else {
    console.error('❌ Некоторые серверы недоступны, но продолжаю работу...\n');
  }
  
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
    
    // Создаем задачу из черновика или генерируем уточняющие вопросы
    const result = await taskManager.createTaskFromDraft(draftPath);
    
    // Проверяем результат
    if (result && result.type === 'questions') {
      console.log(`\n❓ Для задачи требуются уточнения. Заметка с вопросами создана: ${result.path}`);
      console.log(`\n📝 Ответьте на вопросы в заметке и запустите скрипт снова с тем же путем.`);
    }
  } else {
    // Обычный режим
    const taskTitle = args[0];
    
    if (!taskTitle) {
      console.log('❌ Укажите задачу: node index.js "Название задачи"');
      console.log('Или создайте задачу из черновика: node index.js --from-obsidian "AGI-Tasks/Черновик.md"');
      process.exit(1);
    }

    const obsidian = new ObsidianClient();
    const llm = new LLMClient();
    const taskManager = new TaskManager(obsidian, llm);

    // Генерируем план через LLM
    const llmResult = await llm.generateTaskPlanWithContext(taskTitle, '');
    
    if (llmResult.type === 'questions') {
      // Если LLM вернул вопросы, создаем черновик с вопросами
      console.log(`\n❓ Задача требует уточнений. Создаю черновик с вопросами...`);
      
      // Создаем имя файла для черновика
      const safeFilename = taskTitle.replace(/[^\wа-яА-ЯёЁ\s-]/g, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_');
      const draftPath = `AGI-Tasks/Черновик - ${safeFilename}.md`;
      
      // Создаем заметку с вопросами
      const questionsNote = taskManager.createQuestionsNote(taskTitle, llmResult.questions, '');
      await obsidian.createNote(draftPath, questionsNote.content);
      
      console.log(`\n✨ Черновик с вопросами создан: ${draftPath}`);
      console.log(`\n📝 Ответьте на вопросы в заметке и запустите скрипт с флагом --from-obsidian "${draftPath}"`);
    } else {
      // Если LLM вернул план, создаем задачу
      await taskManager.createTask(taskTitle);
    }
  }
}

main().catch(console.error);

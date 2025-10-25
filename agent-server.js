require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ObsidianClient = require('./src/obsidian-client');
const TaskManager = require('./src/task-manager');
const LLMClient = require('./src/llm-client');

const app = express();
const PORT = process.env.PORT || 3012;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Создаем глобальные экземпляры клиентов для повторного использования
let obsidian, llm, taskManager;

async function initializeClients() {
    if (!obsidian || !llm || !taskManager) {
        obsidian = new ObsidianClient();
        llm = new LLMClient();
        taskManager = new TaskManager(obsidian, llm);
        console.log('✅ Клиенты Агента инициализированы');
    }
}

// Middleware для инициализации клиентов
app.use(async (req, res, next) => {
    await initializeClients();
    next();
});

// API Routes для Агента

// Создание новой задачи
app.post('/api/agent/create-task', async (req, res) => {
    try {
        const { taskTitle, context } = req.body;

        if (!taskTitle) {
            return res.status(400).json({ error: 'Название задачи обязательно' });
        }

        console.log(`🚀 Создаю задачу: "${taskTitle}"`);

        // Генерируем план через LLM
        const llmResult = await llm.generateTaskPlanWithContext(taskTitle, context || '');

        if (llmResult.type === 'questions') {
            // Если LLM вернул вопросы, создаем черновик с вопросами
            console.log(`\n❓ Задача требует уточнений. Создаю черновик с вопросами...`);

            // Создаем имя файла для черновика
            const safeFilename = taskTitle.replace(/[^\wа-яА-ЯёЁ\s-]/g, '').replace(/\s+/g, ' ').trim().replace(/\s/g, '_');
            const draftPath = `AGI-Tasks/Черновик - ${safeFilename}.md`;

            // Создаем заметку с вопросами
            const questionsNote = taskManager.createQuestionsNote(taskTitle, llmResult.questions, context || '');
            await obsidian.createNote(draftPath, questionsNote.content);

            console.log(`\n✨ Черновик с вопросами создан: ${draftPath}`);
            console.log(`\n📝 Ответьте на вопросы в заметке и запустите с флагом --from-obsidian "${draftPath}"`);

            res.json({
                success: true,
                type: 'questions',
                path: draftPath,
                questions: llmResult.questions
            });
        } else {
            // Если LLM вернул план, создаем задачу
            const result = await taskManager.createTask(taskTitle);

            console.log(`\n📋 План:`);
            result.steps.forEach((step, idx) => {
                console.log(`   ${idx + 1}. ${step}`);
            });

            console.log(`\n✨ Задача создана в Obsidian: ${result.path}\n`);

            // Извлекаем имя файла из пути
            const filename = result.path.split('/').pop();

            res.json({
                success: true,
                type: 'task',
                task: result,
                filename: filename
            });
        }
    } catch (error) {
        console.error('Ошибка создания задачи через Агента:', error);

        // Определяем тип ошибки и возвращаем понятное сообщение
        let userMessage = 'Произошла ошибка при создании задачи';

        if (error.message.includes('timeout')) {
            userMessage = 'Сервер ИИ недоступен. Попробуйте позже или используйте базовый план.';
        } else if (error.message.includes('Invalid URL') || error.message.includes('undefined')) {
            userMessage = 'Настройки подключения к Obsidian не заданы. Проверьте переменные окружения.';
        } else if (error.message.includes('ECONNREFUSED')) {
            userMessage = 'Не удается подключиться к Obsidian. Проверьте настройки подключения.';
        }

        res.status(500).json({ error: userMessage });
    }
});

// Создание задачи из черновика
app.post('/api/agent/create-from-draft', async (req, res) => {
    try {
        const { draftPath } = req.body;

        if (!draftPath) {
            return res.status(400).json({ error: 'Путь к черновику обязателен' });
        }

        console.log(`\n📖 Читаю черновик: ${draftPath}\n`);

        // Читаем черновик
        const draftContent = await obsidian.readNote(draftPath);

        // Извлекаем заголовок (если есть)
        const titleMatch = draftContent.match(/^#\s+(.+)/m);
        const taskTitle = titleMatch ? titleMatch[1] : 'Задача из черновика';

        console.log(`\n🚀 Анализирую задачу из черновика: "${taskTitle}"\n`);

        // Создаем задачу из черновика или генерируем уточняющие вопросы
        const result = await taskManager.createTaskFromDraft(draftPath);

        // Проверяем результат
        if (result && result.type === 'questions') {
            console.log(`\n❓ Для задачи требуются уточнения. Заметка с вопросами создана: ${result.path}`);
            console.log(`\n📝 Ответьте на вопросы в заметке и запустите скрипт снова с тем же путем.`);

            res.json({
                success: true,
                type: 'questions',
                path: result.path,
                questions: result.questions
            });
        } else {
            console.log(`\n✨ Черновик преобразован в задачу: ${draftPath}\n`);

            res.json({
                success: true,
                type: 'task',
                task: result
            });
        }
    } catch (error) {
        console.error('Ошибка создания задачи из черновика:', error);

        let userMessage = 'Произошла ошибка при создании задачи из черновика';

        if (error.message.includes('ENOENT')) {
            userMessage = 'Черновик не найден. Проверьте путь к файлу.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'Сервер ИИ недоступен. Попробуйте позже.';
        }

        res.status(500).json({ error: userMessage });
    }
});

// Создание подзадачи из шага
app.post('/api/agent/create-subtask', async (req, res) => {
    try {
        const { parentTaskPath, stepIndex } = req.body;

        if (!parentTaskPath || stepIndex === undefined) {
            return res.status(400).json({ error: 'Не указаны параметры родительской задачи или индекс шага' });
        }

        console.log(`\n🔍 Читаю родительскую задачу: ${parentTaskPath}\n`);

        // Читаем родительскую заметку
        const parentContent = await obsidian.readNote(parentTaskPath);

        // Парсим чек-лист
        const { parseChecklist } = require('./src/note-parser');
        const checklistItems = parseChecklist(parentContent);

        if (stepIndex >= checklistItems.length) {
            throw new Error(`Шаг с номером ${stepIndex + 1} не найден. Всего шагов: ${checklistItems.length}`);
        }

        const step = checklistItems[stepIndex];

        if (step.completed) {
            console.log(`⚠️ Шаг "${step.title}" уже выполнен`);
            return res.status(400).json({ error: 'Шаг уже выполнен' });
        }

        console.log(`📌 Создаю подзадачу для шага: "${step.title}"\n`);

        // Создаем подзадачу через Агента
        const result = await taskManager.createSubtask(parentTaskPath, stepIndex);

        console.log(`\n📋 План подзадачи:`);
        result.steps.forEach((s, idx) => {
            console.log(`   ${idx + 1}. ${s}`);
        });

        console.log(`\n✨ Подзадача создана в Obsidian: ${result.path}\n`);

        res.json({
            success: true,
            subtask: result
        });
    } catch (error) {
        console.error('Ошибка создания подзадачи через Агента:', error);

        let userMessage = 'Произошла ошибка при создании подзадачи';

        if (error.message.includes('timeout')) {
            userMessage = 'Сервер ИИ недоступен. Попробуйте позже.';
        } else if (error.message.includes('ENOENT')) {
            userMessage = 'Родительская задача не найдена.';
        }

        res.status(500).json({ error: userMessage });
    }
});

// Получение списка задач
app.get('/api/agent/tasks', async (req, res) => {
    try {
        const fs = require('fs').promises;
        const path = require('path');

        const tasksDir = path.join(__dirname, 'tests', 'AGI-Tasks');
        const files = await fs.readdir(tasksDir);
        const mdFiles = files.filter(file => file.endsWith('.md'));

        const tasks = [];

        for (const file of mdFiles) {
            try {
                const content = await fs.readFile(path.join(tasksDir, file), 'utf8');

                // Парсим frontmatter
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                    const frontmatter = {};
                    const lines = frontmatterMatch[1].split('\n');

                    for (const line of lines) {
                        const [key, ...valueParts] = line.split(':');
                        if (key && valueParts.length > 0) {
                            frontmatter[key.trim()] = valueParts.join(':').trim();
                        }
                    }

                    tasks.push({
                        filename: file,
                        title: content.match(/^#\s+(.+)/m)?.[1] || 'Без названия',
                        status: frontmatter.status || 'pending',
                        task_id: frontmatter.task_id,
                        created: frontmatter.created,
                        parent: frontmatter.parent
                    });
                }
            } catch (error) {
                console.error(`Ошибка чтения файла ${file}:`, error);
            }
        }

        res.json(tasks);
    } catch (error) {
        console.error('Ошибка получения списка задач:', error);
        res.status(500).json({ error: 'Ошибка получения списка задач' });
    }
});

// Обновление статуса задачи
app.put('/api/agent/update-status', async (req, res) => {
    try {
        const { filename, status } = req.body;

        if (!filename || !status) {
            return res.status(400).json({ error: 'Не указаны имя файла или статус' });
        }

        const fs = require('fs').promises;
        const path = require('path');

        // Читаем файл
        const tasksDir = path.join(__dirname, 'tests', 'AGI-Tasks');
        const filePath = path.join(tasksDir, filename);
        let content = await fs.readFile(filePath, 'utf8');

        // Обновляем статус в frontmatter
        content = content.replace(
            /(status:\s*)(\w+)/,
            `$1${status}`
        );

        await fs.writeFile(filePath, content, 'utf8');

        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка обновления статуса задачи:', error);

        let userMessage = 'Произошла ошибка при обновлении статуса задачи';

        if (error.message.includes('ENOENT')) {
            userMessage = 'Файл задачи не найден. Возможно, он был удален.';
        } else if (error.message.includes('EACCES')) {
            userMessage = 'Нет прав доступа к файлу задачи.';
        }

        res.status(500).json({ error: userMessage });
    }
});

// Генерация плана задачи (без создания файла)
app.post('/api/agent/generate-plan', async (req, res) => {
    try {
        const { taskTitle, context } = req.body;

        if (!taskTitle) {
            return res.status(400).json({ error: 'Название задачи обязательно' });
        }

        console.log(`🧠 Генерирую план для задачи: "${taskTitle}"`);

        // Генерируем план через LLM
        const llmResult = await llm.generateTaskPlanWithContext(taskTitle, context || '');

        if (llmResult.type === 'questions') {
            res.json({
                success: true,
                type: 'questions',
                questions: llmResult.questions
            });
        } else {
            res.json({
                success: true,
                type: 'plan',
                steps: llmResult.steps,
                considerations: llmResult.considerations
            });
        }
    } catch (error) {
        console.error('Ошибка генерации плана:', error);

        let userMessage = 'Произошла ошибка при генерации плана';

        if (error.message.includes('timeout')) {
            userMessage = 'Сервер ИИ недоступен. Попробуйте позже.';
        }

        res.status(500).json({ error: userMessage });
    }
});

// Health check endpoint
app.get('/api/agent/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Проверка подключений к серверам перед запуском
async function checkConnections() {
    console.log('\n🔍 Проверка подключений к серверам...\n');

    let allConnectionsOk = true;

    // Проверяем подключение к Obsidian
    const obsidian = new ObsidianClient();
    const obsidianOk = await obsidian.checkConnection();
    if (!obsidianOk) {
        allConnectionsOk = false;
        console.error('❌ Не удается подключиться к Obsidian серверу');
        console.error('   Сервер Агента не будет запущен до исправления проблемы\n');
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
        console.error('   Сервер Агента будет работать в ограниченном режиме\n');
    }

    if (allConnectionsOk) {
        console.log('✅ Все серверы доступны\n');
    }

    return allConnectionsOk;
}

// Запуск сервера
async function startServer() {
    // Проверяем подключения перед запуском
    const connectionsOk = await checkConnections();

    if (!connectionsOk) {
        console.error('🚨 Критические проблемы с подключением к серверам');
        console.error('   Исправьте настройки и перезапустите сервер');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`🚀 Сервер Агента запущен на http://localhost:${PORT}`);
        console.log(`📋 Доступные endpoints:`);
        console.log(`   POST /api/agent/create-task - Создание новой задачи`);
        console.log(`   POST /api/agent/create-from-draft - Создание из черновика`);
        console.log(`   POST /api/agent/create-subtask - Создание подзадачи`);
        console.log(`   GET  /api/agent/tasks - Получение списка задач`);
        console.log(`   PUT  /api/agent/update-status - Обновление статуса`);
        console.log(`   POST /api/agent/generate-plan - Генерация плана`);
        console.log(`   GET  /api/agent/health - Проверка здоровья`);
    });
}

// Запускаем сервер
startServer().catch(console.error);

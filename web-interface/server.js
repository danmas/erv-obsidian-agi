const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const FileParser = require('./src/file-parser');
const TaskTree = require('./src/task-tree');

const app = express();
const PORT = 3013;

// Путь к директории с задачами
const TASKS_DIR = path.join(__dirname, '..', 'tests', 'AGI-Tasks');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints

// Получение дерева задач через Агента
app.get('/api/tasks', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/tasks`);
        const tasks = await response.json();

        // Преобразуем плоский список задач в дерево
        const taskTree = [];
        const taskMap = new Map();

        // Сначала создаем карту задач
        for (const task of tasks) {
            taskMap.set(task.filename, {
                id: task.task_id || `task-${task.filename}`,
                title: task.title,
                type: 'task',
                filename: task.filename,
                status: task.status,
                children: []
            });
        }

        // Строим дерево
        for (const task of tasks) {
            const taskNode = taskMap.get(task.filename);

            // Ищем связанные шаги (файлы с "Шаг" в имени)
            for (const otherTask of tasks) {
                if (otherTask.filename.includes('Шаг') &&
                    otherTask.filename.match(/Шаг\s+\d+/) &&
                    (otherTask.parent === task.task_id ||
                     otherTask.filename.includes(task.title.replace(/[^\wа-яА-ЯёЁ\s-]/g, '')))) {

                    const stepNumberMatch = otherTask.filename.match(/Шаг\s+(\d+)/i);
                    const stepNumber = stepNumberMatch ? parseInt(stepNumberMatch[1]) : 0;

                    taskNode.children.push({
                        id: `${task.task_id}-step-${stepNumber}`,
                        title: otherTask.title,
                        type: 'step',
                        filename: otherTask.filename,
                        status: otherTask.status,
                        stepNumber: stepNumber
                    });
                }
            }

            // Сортируем шаги по номеру
            taskNode.children.sort((a, b) => a.stepNumber - b.stepNumber);

            taskTree.push(taskNode);
        }

        res.json(taskTree);
    } catch (error) {
        console.error('Ошибка при получении дерева задач через Агента:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Получение содержимого файла
app.get('/api/file/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(TASKS_DIR, filename);
        const content = await fs.readFile(filePath, 'utf8');
        
        // Разделяем frontmatter и контент
        const parts = content.split(/^---\n([\s\S]*?)\n---\n/m);
        const frontmatter = parts[1] ? parseFrontmatter(parts[1]) : {};
        const fileContent = parts[2] || content;
        
        res.json({
            filename,
            frontmatter,
            content: fileContent
        });
    } catch (error) {
        console.error(`Ошибка при чтении файла ${req.params.filename}:`, error);
        res.status(404).json({ error: 'Файл не найден' });
    }
});

// Обновление содержимого файла
app.put('/api/file/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const { content } = req.body;
        const filePath = path.join(TASKS_DIR, filename);
        
        // Читаем оригинальный файл для сохранения frontmatter
        const originalContent = await fs.readFile(filePath, 'utf8');
        const frontmatterMatch = originalContent.match(/^(---[\s\S]*?---\n)/);
        const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
        
        const newContent = frontmatter + content;
        await fs.writeFile(filePath, newContent, 'utf8');
        
        res.json({ success: true });
    } catch (error) {
        console.error(`Ошибка при обновлении файла ${req.params.filename}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Парсер frontmatter для сервера
function parseFrontmatter(content) {
    const frontmatter = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
            frontmatter[key.trim()] = valueParts.join(':').trim();
        }
    }
    
    return frontmatter;
}

// Прокси для API Агента (перенаправляем запросы на сервер Агента)
const AGENT_SERVER_URL = 'http://localhost:3012';

// Создание новой задачи через Агента
app.post('/api/agent/create-task', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/create-task`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Создание задачи из черновика
app.post('/api/agent/create-from-draft', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/create-from-draft`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Создание подзадачи из шага
app.post('/api/agent/create-subtask', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/create-subtask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Получение списка задач
app.get('/api/agent/tasks', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/tasks`);
        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Обновление статуса задачи
app.put('/api/agent/update-status', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/update-status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Генерация плана задачи
app.post('/api/agent/generate-plan', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/generate-plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Health check endpoint
app.get('/api/agent/health', async (req, res) => {
    try {
        const response = await fetch(`${AGENT_SERVER_URL}/api/agent/health`);
        const result = await response.json();
        res.json(result);
    } catch (error) {
        console.error('Ошибка прокси к Агент-серверу:', error);
        res.status(500).json({ error: 'Сервер Агента недоступен' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Веб-интерфейс запущен на http://localhost:${PORT}`);
    console.log(`📁 Отслеживаемая директория с задачами: ${TASKS_DIR}`);
});

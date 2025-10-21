const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const FileParser = require('./src/file-parser');
const TaskTree = require('./src/task-tree');

const app = express();
const PORT = 3000;

// Путь к директории с задачами
const TASKS_DIR = path.join(__dirname, '..', 'tests', 'AGI-Tasks');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints

// Получение дерева задач
app.get('/api/tasks', async (req, res) => {
    try {
        const fileParser = new FileParser(TASKS_DIR);
        const taskTree = new TaskTree(fileParser);
        const tree = await taskTree.buildTree();
        res.json(tree);
    } catch (error) {
        console.error('Ошибка при получении дерева задач:', error);
        res.status(500).json({ error: error.message });
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

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Веб-интерфейс запущен на http://localhost:${PORT}`);
    console.log(`📁 Отслеживаемая директория с задачами: ${TASKS_DIR}`);
});

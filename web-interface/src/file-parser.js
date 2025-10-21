const fs = require('fs').promises;
const path = require('path');

class FileParser {
    constructor(tasksDir) {
        this.tasksDir = tasksDir;
    }

    async parseAllFiles() {
        const files = await fs.readdir(this.tasksDir);
        const mdFiles = files.filter(file => file.endsWith('.md'));
        
        const tasks = [];
        for (const file of mdFiles) {
            const task = await this.parseFile(file);
            if (task) tasks.push(task);
        }
        
        return tasks;
    }

    async parseFile(filename) {
        try {
            const filePath = path.join(this.tasksDir, filename);
            const rawContent = await fs.readFile(filePath, 'utf8');

            // Парсим frontmatter
            const frontmatter = this.parseFrontmatter(rawContent);

            // Определяем тип файла (задача или шаг)
            const isStep = filename.includes('Шаг');
            const isMainTask = frontmatter.parent === 'null' || !frontmatter.parent;

            // Извлекаем контент без frontmatter
            const content = rawContent.replace(/^---[\s\S]*?---\n/, '');

            return {
                filename,
                path: filePath,
                type: isStep ? 'step' : 'task',
                isMainTask,
                frontmatter,
                content: content,
                title: this.extractTitle(rawContent)
            };
        } catch (error) {
            console.error(`Ошибка парсинга файла ${filename}:`, error);
            return null;
        }
    }

    parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return {};
        
        const frontmatter = {};
        const lines = match[1].split('\n');
        
        for (const line of lines) {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                frontmatter[key.trim()] = valueParts.join(':').trim();
            }
        }
        
        return frontmatter;
    }

    extractTitle(content) {
        const match = content.match(/^#\s+(.+)/m);
        return match ? match[1] : 'Без названия';
    }
}

module.exports = FileParser;

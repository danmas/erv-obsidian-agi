const path = require('path');

class TaskTree {
    constructor(fileParser) {
        this.fileParser = fileParser;
    }

    async buildTree() {
        const tasks = await this.fileParser.parseAllFiles();
        
        // Разделяем задачи и шаги
        const mainTasks = tasks.filter(task => !task.type.includes('step') && !task.filename.includes('Шаг'));
        const steps = tasks.filter(task => task.type.includes('step') || task.filename.includes('Шаг'));
        
        // Строим дерево
        const tree = [];
        
        for (const task of mainTasks) {
            const taskNode = {
                id: task.frontmatter.task_id || `task-${task.filename}`,
                title: task.title,
                type: 'task',
                filename: task.filename,
                status: task.frontmatter.status || 'pending',
                children: []
            };
            
            // Находим связанные шаги
            taskNode.children = this.findRelatedSteps(task, steps);
            
            tree.push(taskNode);
        }
        
        return tree;
    }

    findRelatedSteps(task, allSteps) {
        const relatedSteps = [];

        for (const step of allSteps) {
            // Проверяем, связан ли шаг с задачей по parent_task в frontmatter
            if (step.frontmatter.parent_task && task.frontmatter.task_id) {
                // Сравниваем названия задач, очищая от лишних символов
                const cleanParentTask = step.frontmatter.parent_task.replace(/[^\wа-яА-ЯёЁ\s-]/g, '').trim();
                const cleanTaskTitle = task.title.replace(/[^\wа-яА-ЯёЁ\s-]/g, '').trim();

                if (cleanParentTask === cleanTaskTitle ||
                    cleanParentTask.includes(cleanTaskTitle) ||
                    cleanTaskTitle.includes(cleanParentTask)) {

                    // Извлекаем номер шага из имени файла или frontmatter
                    const stepNumber = step.frontmatter.step_number || this.extractStepNumber(step.filename);

                    relatedSteps.push({
                        id: `${task.frontmatter.task_id}-step-${stepNumber}`,
                        title: step.title,
                        type: 'step',
                        filename: step.filename,
                        status: step.frontmatter.status || 'pending',
                        stepNumber: stepNumber
                    });
                }
            }
        }

        // Сортируем по номеру шага
        return relatedSteps.sort((a, b) => a.stepNumber - b.stepNumber);
    }

    extractStepNumber(filename) {
        const match = filename.match(/Шаг\s+(\d+)/i);
        return match ? parseInt(match[1]) : 0;
    }
}

module.exports = TaskTree;

// Глобальные переменные
let taskTree = [];
let selectedNode = null;

// Загрузка дерева задач
async function loadTaskTree() {
    try {
        const response = await fetch('/api/tasks');
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        taskTree = await response.json();
        renderTaskTree();
    } catch (error) {
        console.error('Ошибка при загрузке дерева задач:', error);
        document.getElementById('taskTree').innerHTML = `
            <div class="error">
                Ошибка загрузки задач: ${error.message}
                <button onclick="loadTaskTree()" class="btn btn-small">Повторить</button>
            </div>
        `;
    }
}

// Отрисовка дерева задач
function renderTaskTree() {
    const treeContainer = document.getElementById('taskTree');
    
    if (taskTree.length === 0) {
        treeContainer.innerHTML = '<div class="empty-tree">Нет доступных задач</div>';
        return;
    }
    
    let html = '';
    
    // Сортируем задачи по имени файла
    taskTree.sort((a, b) => a.filename.localeCompare(b.filename));
    
    // Отрисовываем каждую задачу и её шаги
    for (const task of taskTree) {
        // Добавляем задачу
        html += `
            <div class="task-item task ${task.status}" 
                 data-filename="${task.filename}" 
                 data-type="task"
                 onclick="selectNode('${task.filename}', 'task')">
                ${task.title}
                <span class="status-badge ${task.status}">${getStatusText(task.status)}</span>
            </div>
        `;
        
        // Добавляем шаги задачи
        if (task.children && task.children.length > 0) {
            for (const step of task.children) {
                html += `
                    <div class="task-item step ${step.status}" 
                         data-filename="${step.filename}" 
                         data-type="step"
                         onclick="selectNode('${step.filename}', 'step')">
                        ${step.title}
                        <span class="status-badge ${step.status}">${getStatusText(step.status)}</span>
                    </div>
                `;
            }
        }
    }
    
    treeContainer.innerHTML = html;
    
    // Если был выбранный элемент, восстанавливаем выделение
    if (selectedNode) {
        const selectedElement = document.querySelector(`[data-filename="${selectedNode.filename}"]`);
        if (selectedElement) {
            selectedElement.classList.add('selected');
        }
    }
}

// Выбор узла дерева
function selectNode(filename, type) {
    // Снимаем выделение с предыдущего элемента
    const previousSelected = document.querySelector('.task-item.selected');
    if (previousSelected) {
        previousSelected.classList.remove('selected');
    }
    
    // Выделяем новый элемент
    const selectedElement = document.querySelector(`[data-filename="${filename}"]`);
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
    
    // Сохраняем выбранный узел
    selectedNode = { filename, type };
    
    // Загружаем содержимое файла
    loadFileContent(filename);
}

// Загрузка содержимого файла
async function loadFileContent(filename) {
    try {
        document.getElementById('currentFile').textContent = filename;
        document.getElementById('saveFile').disabled = true;
        document.getElementById('saveStatus').textContent = 'Загрузка...';
        
        const response = await fetch(`/api/file/${encodeURIComponent(filename)}`);
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const fileData = await response.json();
        
        // Отображаем содержимое в редакторе
        const editor = document.getElementById('fileEditor');
        editor.value = fileData.content;
        
        // Обновляем превью Markdown
        updateMarkdownPreview();
        
        document.getElementById('saveStatus').textContent = '';
        document.getElementById('saveFile').disabled = false;
    } catch (error) {
        console.error(`Ошибка при загрузке файла ${filename}:`, error);
        document.getElementById('saveStatus').textContent = `Ошибка: ${error.message}`;
    }
}

// Получение текстового представления статуса
function getStatusText(status) {
    switch(status) {
        case 'pending': return 'Ожидание';
        case 'in-progress': 
        case 'in_progress': return 'В работе';
        case 'completed': return 'Завершено';
        default: return status;
    }
}

// Обработчик кнопки обновления дерева
document.getElementById('refreshTree').addEventListener('click', loadTaskTree);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadTaskTree();
});

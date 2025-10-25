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
    
    // Сортируем: черновики в начало, потом задачи
    taskTree.sort((a, b) => {
        const aIsDraft = a.filename.includes('Черновик');
        const bIsDraft = b.filename.includes('Черновик');
        
        if (aIsDraft && !bIsDraft) return -1;
        if (!aIsDraft && bIsDraft) return 1;
        
        return a.filename.localeCompare(b.filename);
    });
    
    // Отрисовываем каждую задачу/черновик и её шаги
    for (const task of taskTree) {
        const isDraft = task.filename.includes('Черновик');
        const taskClass = isDraft ? 'draft' : 'task';
        const taskType = isDraft ? 'draft' : 'task';
        
        // Добавляем задачу или черновик
        html += `
            <div class="task-item ${taskClass} ${task.status}" 
                 data-filename="${task.filename}" 
                 data-type="${taskType}"
                 onclick="selectNode('${task.filename}', '${taskType}')">
                ${isDraft ? '📝 ' : ''}${task.title}
                ${!isDraft ? `<span class="status-badge ${task.status}">${getStatusText(task.status)}</span>` : '<span class="status-badge draft">Черновик</span>'}
            </div>
        `;
        
        // Добавляем шаги задачи (для черновиков шагов нет)
        if (!isDraft && task.children && task.children.length > 0) {
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
    
    // Показываем/скрываем кнопки действий в зависимости от типа
    updateActionButtons(type);
}

// Обновление видимости кнопок действий
function updateActionButtons(type) {
    const taskActionsPanel = document.getElementById('taskActions');
    const createSubtaskBtn = document.getElementById('createSubtaskBtn');
    const createFromDraftBtn = document.getElementById('createFromDraftBtn');
    const markCompletedBtn = document.getElementById('markCompletedBtn');
    const markPendingBtn = document.getElementById('markPendingBtn');
    
    if (type === 'draft') {
        // Для черновика показываем только кнопку "Создать задачу из черновика"
        if (createFromDraftBtn) createFromDraftBtn.style.display = 'block';
        if (createSubtaskBtn) createSubtaskBtn.style.display = 'none';
        if (markCompletedBtn) markCompletedBtn.style.display = 'none';
        if (markPendingBtn) markPendingBtn.style.display = 'none';
    } else {
        // Для задач и шагов показываем обычные кнопки
        if (createFromDraftBtn) createFromDraftBtn.style.display = 'none';
        if (createSubtaskBtn) createSubtaskBtn.style.display = 'block';
        if (markCompletedBtn) markCompletedBtn.style.display = 'block';
        if (markPendingBtn) markPendingBtn.style.display = 'block';
    }
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

// Функция для отображения уведомлений
function showNotification(message, type = 'info') {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Добавляем элемент в DOM
    document.body.appendChild(notification);
    
    // Показываем уведомление
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Функции для работы с Агентом

// Создание новой задачи через Агента
async function createTask() {
    const taskTitle = document.getElementById('taskTitleInput').value.trim();
    const taskDescription = document.getElementById('taskDescriptionInput').value.trim();
    
    if (!taskTitle) {
        showNotification('Введите название задачи', 'error');
        return;
    }

    try {
        const response = await fetch('/api/agent/create-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                taskTitle,
                context: taskDescription 
            })
        });

        const result = await response.json();

        if (result.success) {
            // Закрываем модальное окно и очищаем форму
            document.getElementById('createTaskModal').style.display = 'none';
            document.getElementById('taskTitleInput').value = '';
            document.getElementById('taskDescriptionInput').value = '';
            
            // Перезагружаем дерево задач
            await loadTaskTree();
            
            if (result.type === 'questions') {
                // Если созданы вопросы - показываем черновик и кнопку для продолжения
                const draftFilename = result.path.split('/').pop();
                setTimeout(() => {
                    selectNode(draftFilename, 'draft');
                }, 100);
                showNotification('Черновик с вопросами создан. Ответьте на вопросы и нажмите "Создать задачу из черновика".', 'info');
            } else {
                // Находим и выбираем новую задачу
                if (result.filename) {
                    setTimeout(() => {
                        selectNode(result.filename, 'task');
                    }, 100);
                }
                showNotification('Задача создана! Агент сгенерировал план выполнения.', 'success');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showNotification('Ошибка создания задачи: ' + error.message, 'error');
    }
}

// Создание задачи из черновика
async function createTaskFromDraft() {
    if (!selectedNode || selectedNode.type !== 'draft') {
        showNotification('Выберите черновик для создания задачи', 'error');
        return;
    }

    try {
        showNotification('Создаю задачу из черновика...', 'info');
        
        const response = await fetch('/api/agent/create-from-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                draftPath: `AGI-Tasks/${selectedNode.filename}`
            })
        });

        const result = await response.json();

        if (result.success) {
            if (result.type === 'questions') {
                // Если снова вернулись вопросы
                await loadTaskTree();
                showNotification('Требуются дополнительные уточнения. Ответьте на новые вопросы.', 'warning');
            } else {
                // Задача успешно создана
                await loadTaskTree();
                
                // Находим и выбираем новую задачу
                if (result.task && result.task.path) {
                    const filename = result.task.path.split('/').pop();
                    setTimeout(() => {
                        selectNode(filename, 'task');
                    }, 100);
                }
                
                showNotification('Задача создана из черновика! Агент сгенерировал план выполнения.', 'success');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showNotification('Ошибка создания задачи из черновика: ' + error.message, 'error');
    }
}

// Создание подзадачи из шага через Агента
async function createSubtask() {
    if (!selectedNode) {
        showNotification('Выберите задачу для создания подзадачи', 'error');
        return;
    }

    try {
        // Находим индекс шага в чек-листе родительской задачи
        const parentTask = findParentTask(selectedNode.filename);
        const stepIndex = findStepIndex(selectedNode.filename, parentTask);

        const response = await fetch('/api/agent/create-subtask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parentTaskPath: parentTask,
                stepIndex: stepIndex
            })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('taskActions').style.display = 'none';
            await loadTaskTree();
            showNotification('Подзадача создана! Агент сгенерировал детальный план.', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showNotification('Ошибка создания подзадачи: ' + error.message, 'error');
    }
}

// Обновление статуса задачи
async function updateTaskStatus(status) {
    if (!selectedNode) {
        showNotification('Выберите задачу для обновления статуса', 'error');
        return;
    }

    try {
        const response = await fetch('/api/agent/update-status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: selectedNode.filename,
                status: status
            })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('taskActions').style.display = 'none';
            await loadTaskTree();
            showNotification('Статус обновлен!', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showNotification('Ошибка обновления статуса: ' + error.message, 'error');
    }
}

// Вспомогательные функции для поиска родительской задачи и индекса шага
function findParentTask(filename) {
    // Ищем задачу в дереве по имени файла
    for (const task of taskTree) {
        if (task.filename === filename && task.type === 'task') {
            return task.filename;
        }
        // Ищем в подзадачах
        if (task.children) {
            for (const child of task.children) {
                if (child.filename === filename && child.type === 'step') {
                    return task.filename;
                }
            }
        }
    }
    return null;
}

function findStepIndex(filename, parentTaskFilename) {
    // Ищем задачу в дереве
    for (const task of taskTree) {
        if (task.filename === parentTaskFilename && task.children) {
            // Находим индекс шага в чек-листе
            const stepIndex = task.children.findIndex(child => child.filename === filename);
            return stepIndex !== -1 ? stepIndex : 0;
        }
    }
    return 0;
}

// Обработчик кнопки обновления дерева
document.getElementById('refreshTree').addEventListener('click', loadTaskTree);

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadTaskTree();

    // Обработчики событий для модальных окон и кнопок

    // Кнопка создания задачи
    const createTaskBtn = document.getElementById('createTaskBtn');
    if (createTaskBtn) {
        createTaskBtn.addEventListener('click', () => {
            document.getElementById('createTaskModal').style.display = 'block';
        });
    }

    // Кнопка создания задачи из черновика
    const createFromDraftBtn = document.getElementById('createFromDraftBtn');
    if (createFromDraftBtn) {
        createFromDraftBtn.addEventListener('click', createTaskFromDraft);
    }

    // Кнопка создания подзадачи
    const createSubtaskBtn = document.getElementById('createSubtaskBtn');
    if (createSubtaskBtn) {
        createSubtaskBtn.addEventListener('click', createSubtask);
    }

    // Кнопка отметки выполненной
    const markCompletedBtn = document.getElementById('markCompletedBtn');
    if (markCompletedBtn) {
        markCompletedBtn.addEventListener('click', () => updateTaskStatus('completed'));
    }

    // Кнопка отметки в ожидание
    const markPendingBtn = document.getElementById('markPendingBtn');
    if (markPendingBtn) {
        markPendingBtn.addEventListener('click', () => updateTaskStatus('pending'));
    }

    // Кнопка отправки формы создания задачи
    const submitCreateTask = document.getElementById('submitCreateTask');
    if (submitCreateTask) {
        submitCreateTask.addEventListener('click', createTask);
    }

    // Кнопки закрытия модального окна
    const closeButtons = document.querySelectorAll('.close-modal, .close-modal-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('createTaskModal').style.display = 'none';
            document.getElementById('taskActions').style.display = 'none';
            document.getElementById('taskTitleInput').value = '';
            document.getElementById('taskDescriptionInput').value = '';
        });
    });

    // Показ панели действий при клике правой кнопкой мыши на задаче
    document.addEventListener('contextmenu', (event) => {
        const taskItem = event.target.closest('.task-item');
        if (taskItem && selectedNode) {
            event.preventDefault();
            const taskActions = document.getElementById('taskActions');
            taskActions.style.display = 'block';
            updateActionButtons(selectedNode.type);
        }
    });

    // Скрытие панели действий при клике вне её
    document.addEventListener('click', (event) => {
        const taskActions = document.getElementById('taskActions');
        if (!taskActions.contains(event.target) && !event.target.closest('.task-item')) {
            taskActions.style.display = 'none';
        }
    });
});

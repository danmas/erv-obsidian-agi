// Глобальные переменные
let currentMode = 'md'; // 'md' или 'txt'
let isEditing = false;
let isDarkTheme = true; // Темная тема по умолчанию

// Элементы DOM
const fileEditor = document.getElementById('fileEditor');
const markdownPreview = document.getElementById('markdownPreview');
const saveButton = document.getElementById('saveFile');
const saveStatus = document.getElementById('saveStatus');
const viewTxtButton = document.getElementById('viewTxt');
const viewMdButton = document.getElementById('viewMd');
const toggleThemeButton = document.getElementById('toggleTheme');

// Обновление превью Markdown
function updateMarkdownPreview() {
    if (currentMode === 'md') {
        // Используем библиотеку marked для рендеринга Markdown
        markdownPreview.innerHTML = marked.parse(fileEditor.value);
    } else {
        // В текстовом режиме просто отображаем текст с сохранением переносов строк
        markdownPreview.innerHTML = `<pre>${escapeHtml(fileEditor.value)}</pre>`;
    }
}

// Экранирование HTML
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Переключение между режимами просмотра и редактирования
function toggleEditMode() {
    isEditing = !isEditing;
    
    if (isEditing) {
        fileEditor.style.display = 'block';
        markdownPreview.style.display = 'none';
        fileEditor.focus();
    } else {
        fileEditor.style.display = 'none';
        markdownPreview.style.display = 'block';
        updateMarkdownPreview();
    }
}

// Переключение темы
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    const body = document.body;

    if (isDarkTheme) {
        body.classList.add('dark-theme');
        toggleThemeButton.textContent = '🌙';
        toggleThemeButton.title = 'Переключить на светлую тему';
    } else {
        body.classList.remove('dark-theme');
        toggleThemeButton.textContent = '☀️';
        toggleThemeButton.title = 'Переключить на темную тему';
    }
}

// Переключение между режимами TXT и MD
function switchViewMode(mode) {
    currentMode = mode;

    if (mode === 'txt') {
        viewTxtButton.classList.add('active');
        viewMdButton.classList.remove('active');
    } else {
        viewMdButton.classList.add('active');
        viewTxtButton.classList.remove('active');
    }

    updateMarkdownPreview();
}

// Сохранение файла
async function saveFile() {
    if (!selectedNode) return;
    
    const filename = selectedNode.filename;
    const content = fileEditor.value;
    
    saveButton.disabled = true;
    saveStatus.textContent = 'Сохранение...';
    
    try {
        const response = await fetch(`/api/file/${encodeURIComponent(filename)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            saveStatus.textContent = 'Сохранено';
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 2000);
        } else {
            throw new Error('Ошибка при сохранении файла');
        }
    } catch (error) {
        console.error(`Ошибка при сохранении файла ${filename}:`, error);
        saveStatus.textContent = `Ошибка: ${error.message}`;
    } finally {
        saveButton.disabled = false;
    }
}

// Обработчики событий
fileEditor.addEventListener('input', () => {
    updateMarkdownPreview();
});

fileEditor.addEventListener('focus', () => {
    if (!isEditing) {
        toggleEditMode();
    }
});

markdownPreview.addEventListener('click', () => {
    if (!isEditing) {
        toggleEditMode();
    }
});

saveButton.addEventListener('click', saveFile);

viewTxtButton.addEventListener('click', () => switchViewMode('txt'));
viewMdButton.addEventListener('click', () => switchViewMode('md'));

// Переключение темы
toggleThemeButton.addEventListener('click', toggleTheme);

// Горячие клавиши
document.addEventListener('keydown', (e) => {
    // Ctrl+S для сохранения
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!saveButton.disabled) {
            saveFile();
        }
    }
    
    // Esc для выхода из режима редактирования
    if (e.key === 'Escape' && isEditing) {
        toggleEditMode();
    }
});

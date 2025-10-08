/**
 * Утилиты для парсинга заметок Obsidian
 */

/**
 * Извлекает YAML фронтматтер из заметки
 * @param {string} content - Содержимое заметки
 * @returns {Object} - Объект с метаданными
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);
  
  if (!match) return {};
  
  const frontmatterText = match[1];
  const metadata = {};
  
  frontmatterText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      metadata[key.trim()] = value;
    }
  });
  
  return metadata;
}

/**
 * Извлекает все пункты чек-листа из заметки
 * @param {string} content - Содержимое заметки
 * @returns {Array} - Массив объектов с пунктами чек-листа
 */
function parseChecklist(content) {
  const checklistItems = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ищем строки вида "- [ ] [[Название]]" или "- [x] [[Название]]"
    const match = line.match(/^-\s\[([ x])\]\s\[\[(.+?)\]\]/);
    
    if (match) {
      const completed = match[1] === 'x';
      const title = match[2];
      checklistItems.push({
        index: checklistItems.length,
        title,
        completed,
        lineNumber: i
      });
    }
  }
  
  return checklistItems;
}

/**
 * Извлекает заголовок задачи из заметки
 * @param {string} content - Содержимое заметки
 * @returns {string} - Заголовок задачи
 */
function extractTaskTitle(content) {
  const titleMatch = content.match(/# 🎯 Задача: (.+)/);
  return titleMatch ? titleMatch[1] : 'Неизвестная задача';
}

/**
 * Обновляет статус пункта чек-листа в заметке
 * @param {string} content - Содержимое заметки
 * @param {number} stepIndex - Индекс шага (начиная с 0)
 * @param {boolean} completed - Новый статус
 * @returns {string} - Обновленное содержимое заметки
 */
function updateChecklistItem(content, stepIndex, completed) {
  const lines = content.split('\n');
  const checklistItems = parseChecklist(content);
  
  if (stepIndex >= checklistItems.length) {
    throw new Error(`Шаг с индексом ${stepIndex} не найден`);
  }
  
  const item = checklistItems[stepIndex];
  const checkbox = completed ? '[x]' : '[ ]';
  lines[item.lineNumber] = `- ${checkbox} [[${item.title}]]`;
  
  return lines.join('\n');
}

module.exports = {
  parseFrontmatter,
  parseChecklist,
  extractTaskTitle,
  updateChecklistItem
};

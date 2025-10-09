/**
 * Вспомогательные функции для исправления кодировки русского текста
 */

/**
 * Исправляет кодировку русского текста
 * @param {string} text - Текст с возможными проблемами кодировки
 * @returns {string} - Исправленный текст
 */
function fixRussianEncoding(text) {
  if (!text || typeof text !== 'string') return text;
  
  // Карта замены неправильно закодированных символов
  const replacementMap = {
    'Рё': 'и', 'Р°': 'а', 'Р±': 'б', 'РІ': 'в', 'Рі': 'г', 'Рґ': 'д', 'Рµ': 'е', 'РЁ': 'ё',
    'Р¶': 'ж', 'Р·': 'з', 'Рё': 'и', 'Р№': 'й', 'Рє': 'к', 'Р»': 'л', 'Рј': 'м', 'РЅ': 'н',
    'Рѕ': 'о', 'Рї': 'п', 'СЂ': 'р', 'СЃ': 'с', 'С‚': 'т', 'Сѓ': 'у', 'С„': 'ф', 'С…': 'х',
    'С†': 'ц', 'С‡': 'ч', 'С€': 'ш', 'С‰': 'щ', 'СЉ': 'ъ', 'С‹': 'ы', 'СЊ': 'ь', 'СЌ': 'э',
    'СЋ': 'ю', 'СЏ': 'я'
  };
  
  // Заменяем неправильно закодированные последовательности
  let fixedText = text;
  for (const [broken, fixed] of Object.entries(replacementMap)) {
    fixedText = fixedText.replace(new RegExp(broken, 'g'), fixed);
  }
  
  // Специальные случаи для часто встречающихся фраз
  const specialCases = {
    'РЎРѕР·РґР°С‚СЊ': 'Создать',
    'СѓРїСЂР°РІР»РµРЅРёСЏ': 'управления',
    'РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё': 'пользователями',
    'РґР»СЏ': 'для',
    'РЎРѕР·РґР°С‚СЊ REST API РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё': 'Создать REST API для управления пользователями'
  };
  
  for (const [broken, fixed] of Object.entries(specialCases)) {
    fixedText = fixedText.replace(new RegExp(broken, 'g'), fixed);
  }
  
  return fixedText;
}

/**
 * Санитизирует строку для использования в имени файла
 * @param {string} filename - Исходное имя файла
 * @returns {string} - Безопасное имя файла
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'Untitled';
  
  let sanitized = filename;
  
  // Если есть запятая, берем только текст до первой запятой (обычно после запятой идут команды/примеры)
  const commaIndex = sanitized.indexOf(',');
  if (commaIndex > 20) { // Если запятая не в самом начале
    sanitized = sanitized.substring(0, commaIndex);
  }
  
  // Удаляем обратные кавычки и их содержимое (команды в markdown)
  sanitized = sanitized.replace(/`[^`]*`/g, '');
  
  // Удаляем запрещенные символы для Windows и Unix: < > : " / \ | ? * $ ` ~ # & ! @ % ^ ( ) [ ] { } ; =
  sanitized = sanitized.replace(/[<>:"/\\|?*$`~#&!@%^()[\]{};=]/g, '');
  
  // Удаляем переносы строк и табуляцию
  sanitized = sanitized.replace(/[\r\n\t]/g, ' ');
  
  // Заменяем множественные пробелы на один
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Убираем пробелы в начале и конце
  sanitized = sanitized.trim();
  
  // Убираем точки в начале и конце (Windows не любит)
  sanitized = sanitized.replace(/^\.+|\.+$/g, '');
  
  // Ограничиваем длину (для читаемости и совместимости)
  const maxLength = 100;
  if (sanitized.length > maxLength) {
    // Обрезаем по словам, а не посередине слова
    sanitized = sanitized.substring(0, maxLength);
    const lastSpace = sanitized.lastIndexOf(' ');
    if (lastSpace > 50) { // Если есть пробел не слишком близко к началу
      sanitized = sanitized.substring(0, lastSpace);
    }
    sanitized = sanitized.trim();
  }
  
  // Если после всех операций имя пустое, возвращаем дефолтное
  return sanitized || 'Untitled';
}

module.exports = { fixRussianEncoding, sanitizeFilename };
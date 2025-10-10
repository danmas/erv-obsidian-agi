const axios = require('axios');

class ObsidianClient {
  constructor() {
    this.baseUrl = `${process.env.OBSIDIAN_PROTOCOL}://${process.env.OBSIDIAN_HOST}:${process.env.OBSIDIAN_PORT}`;
    this.apiKey = process.env.OBSIDIAN_API_KEY;
  }

  async createNote(path, content) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/vault/${encodeURIComponent(path)}`,
        content,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'text/markdown'
          }
        }
      );
      console.log(`✅ Заметка создана: ${path}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Ошибка создания заметки: ${error.message}`);
      throw error;
    }
  }

  async updateNote(path, content) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/vault/${encodeURIComponent(path)}`,
        content,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'text/markdown'
          }
        }
      );
      console.log(`✅ Заметка обновлена: ${path}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Ошибка обновления заметки: ${error.message}`);
      throw error;
    }
  }

  async readNote(path) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/vault/${encodeURIComponent(path)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Ошибка чтения заметки: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Проверяет существование заметки
   * @param {string} path - Путь к заметке
   * @returns {boolean} - true если заметка существует, иначе false
   */
  async noteExists(path) {
    try {
      await axios.head(
        `${this.baseUrl}/vault/${encodeURIComponent(path)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      return true;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      console.error(`❌ Ошибка проверки существования заметки: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Создает заметку с вопросами
   * @param {string} path - Путь к заметке
   * @param {string} title - Название задачи
   * @param {Array} questions - Массив вопросов
   * @returns {Object} - Результат создания заметки
   */
  async createQuestionsNote(path, title, questions) {
    const created = new Date().toISOString();
    
    const frontmatter = `---
status: questions
created: ${created}
---`;

    // Форматируем вопросы в виде списка
    const questionsList = questions.map((q, idx) => `${idx + 1}. ${q}\nОтвет: `).join('\n\n');

    const content = `${frontmatter}

# ❓ Уточняющие вопросы: ${title}

## Уточняющие вопросы:

${questionsList}

---
**Создано:** ${new Date().toLocaleString('ru-RU')}
**Инструкция:** Ответьте на вопросы выше и запустите скрипт снова с тем же путем к заметке.
`;

    return await this.createNote(path, content);
  }
}

module.exports = ObsidianClient;

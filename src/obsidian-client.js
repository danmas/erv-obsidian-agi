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

  /**
   * Проверяет доступность сервера Obsidian
   * @returns {boolean} - true если сервер доступен, иначе false
   */
  async checkConnection() {
    try {
      console.log(`🔍 Проверяю доступность Obsidian сервера...`);
      console.log(`📡 Подключаюсь к: ${this.baseUrl}`);
      console.log(`🔑 API ключ: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'не задан'}`);

      // Используем тот же endpoint что и в рабочих методах - список файлов в vault
      const fullUrl = `${this.baseUrl}/vault/`;
      
      const response = await axios.get(fullUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 5000,
        validateStatus: function (status) {
          return status < 500; // Разрешаем редиректы и клиентские ошибки для диагностики
        }
      });

      if (response.status === 200) {
        console.log(`✅ Obsidian сервер доступен`);
        return true;
      }

      if (response.status === 401) {
        console.error(`❌ Ошибка авторизации: API ключ недействителен`);
        console.error(`   Текущий ключ: ${this.apiKey}`);
        console.error(`   Попробуйте обновить OBSIDIAN_API_KEY в .env файле`);
        return false;
      }

      if (response.status === 404) {
        console.error(`❌ Сервер отвечает, но endpoint не найден (статус: ${response.status})`);
        console.error(`   Возможно, плагин Local REST API не активирован`);
        return false;
      }

      console.error(`❌ Неожиданный статус ответа: ${response.status}`);
      return false;

    } catch (error) {
      console.error(`❌ Obsidian сервер недоступен: ${error.message}`);

      if (error.code === 'ECONNREFUSED') {
        console.error(`❌ Не удается подключиться к серверу на ${this.baseUrl}`);
        console.error(`   Убедитесь что:`);
        console.error(`   1. Obsidian запущен`);
        console.error(`   2. Плагин Local REST API установлен и активирован`);
        console.error(`   3. Сервер запущен на порту ${process.env.OBSIDIAN_PORT}`);
        console.error(`   4. Нет firewall блокировки порта`);
      } else if (error.response && error.response.status === 401) {
        console.error(`❌ Ошибка авторизации: API ключ недействителен`);
        console.error(`   Текущий ключ: ${this.apiKey}`);
      } else if (error.code === 'ENOTFOUND') {
        console.error(`❌ Не удается разрешить адрес ${process.env.OBSIDIAN_HOST}`);
        console.error(`   Проверьте настройки OBSIDIAN_HOST`);
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`❌ Таймаут подключения к серверу`);
        console.error(`   Сервер отвечает слишком медленно или недоступен`);
      } else {
        console.error(`❌ Неизвестная ошибка:`, error.message);
        if (error.response) {
          console.error(`   Статус ответа: ${error.response.status}`);
          console.error(`   Данные ответа:`, error.response.data);
        }
      }

      return false;
    }
  }
}

module.exports = ObsidianClient;

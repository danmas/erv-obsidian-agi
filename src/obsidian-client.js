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
}

module.exports = ObsidianClient;

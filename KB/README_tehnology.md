# Технологии 
Технологии NodeJS JS 


# Взаимодействие с obsidian

Поключение к obsidian через REST_API
    "env": {
      "OBSIDIAN_API_KEY": "d37c126e2ba5e794a000d3e44a5e6b91dca181296391f9aa4c169a9aeb571950",
      "OBSIDIAN_VERIFY_SSL": "false",
      "VERIFY_SSL": "false",
      "OBSIDIAN_PROTOCOL": "http",
      "OBSIDIAN_HOST": "192.168.1.254",
      "OBSIDIAN_PORT": "27123",
      "NODE_ENV": "development",
      "REQUEST_TIMEOUT": "5000",
      "MAX_CONTENT_LENGTH": "52428800",
      "MAX_BODY_LENGTH": "52428800",
      "RATE_LIMIT_WINDOW_MS": "900000",
      "RATE_LIMIT_MAX_REQUESTS": "200",
      "TOOL_TIMEOUT_MS": "60000"
    }

# Работа с моделями (Мозг)

Работа с моделями через сервер моделей (aian-model)
url_modelhttp://usa:3002
model=FAST - 


Пример запроса к LLM 
curl -X POST http://user:3002/api/send-request \
-H "Content-Type: application/json" \
-d '{"model": "FAST", "prompt": "Ты полезный помощник", "inputText": "Привет!", "saveResponse": true}'
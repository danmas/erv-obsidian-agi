// Тестовый скрипт для проверки API Агента
const http = require('http');

async function testAgentAPI() {
    console.log('🧪 Тестирование API Агента...\n');

    // Тест 1: Проверка здоровья
    console.log('1. Проверка здоровья сервера...');
    try {
        const healthResponse = await makeRequest('/api/agent/health');
        console.log('✅ Сервер отвечает:', JSON.parse(healthResponse));
    } catch (error) {
        console.log('❌ Ошибка проверки здоровья:', error.message);
        return;
    }

    // Тест 2: Получение списка задач
    console.log('\n2. Получение списка задач...');
    try {
        const tasksResponse = await makeRequest('/api/agent/tasks');
        const tasks = JSON.parse(tasksResponse);
        console.log(`✅ Получено ${tasks.length} задач`);

        if (tasks.length > 0) {
            console.log('Первая задача:', tasks[0].title);
        }
    } catch (error) {
        console.log('❌ Ошибка получения задач:', error.message);
    }

    // Тест 3: Генерация плана (без создания файла)
    console.log('\n3. Генерация плана задачи...');
    try {
        const planData = JSON.stringify({
            taskTitle: 'Тестовая задача для проверки API'
        });

        const planResponse = await makeRequest('/api/agent/generate-plan', 'POST', planData);
        const plan = JSON.parse(planResponse);

        if (plan.success) {
            if (plan.type === 'questions') {
                console.log('✅ Получены вопросы для уточнения:', plan.questions.length, 'вопросов');
            } else {
                console.log('✅ Сгенерирован план:', plan.steps.length, 'шагов');
                console.log('Шаги:', plan.steps.slice(0, 3).join(', '), '...');
            }
        } else {
            console.log('❌ Ошибка генерации плана:', plan.error);
        }
    } catch (error) {
        console.log('❌ Ошибка генерации плана:', error.message);
    }

    console.log('\n🎯 Тестирование завершено!');
}

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3012,
            path: path,
            method: method,
            headers: data ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            } : {}
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseData);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(data);
        }

        req.end();
    });
}

// Запускаем тестирование
testAgentAPI().catch(console.error);



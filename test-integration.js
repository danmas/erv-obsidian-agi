// Тест интеграции Агента и веб-интерфейса
const http = require('http');

async function testIntegration() {
    console.log('🧪 Тестирование интеграции Агента и веб-интерфейса...\n');

    // Тест 1: Проверка здоровья Агент-сервера
    console.log('1. Проверка Агент-сервера...');
    try {
        const healthResponse = await makeRequest('http://localhost:3012/api/agent/health');
        console.log('✅ Агент-сервер отвечает');
    } catch (error) {
        console.log('❌ Агент-сервер недоступен:', error.message);
        return;
    }

    // Тест 2: Генерация плана через Агент-сервер
    console.log('\n2. Генерация плана через Агент-сервер...');
    try {
        const planData = JSON.stringify({
            taskTitle: 'Создать веб-интерфейс для управления задачами'
        });

        const planResponse = await makeRequest('http://localhost:3012/api/agent/generate-plan', 'POST', planData);
        const plan = JSON.parse(planResponse);

        if (plan.success) {
            console.log('✅ План сгенерирован:');
            if (plan.type === 'questions') {
                console.log('   Вопросы для уточнения:', plan.questions.length);
            } else {
                console.log('   Шаги:', plan.steps.length);
                console.log('   Первый шаг:', plan.steps[0]);
            }
        } else {
            console.log('❌ Ошибка генерации плана:', plan.error);
        }
    } catch (error) {
        console.log('❌ Ошибка генерации плана:', error.message);
    }

    // Тест 3: Получение задач через веб-интерфейс (прокси к Агент-серверу)
    console.log('\n3. Получение задач через веб-интерфейс...');
    try {
        const tasksResponse = await makeRequest('http://localhost:3000/api/tasks');
        const tasks = JSON.parse(tasksResponse);
        console.log(`✅ Получено ${tasks.length} задач через веб-интерфейс`);

        if (tasks.length > 0) {
            console.log('Первая задача:', tasks[0].title.substring(0, 50) + '...');
        }
    } catch (error) {
        console.log('❌ Ошибка получения задач через веб-интерфейс:', error.message);
    }

    console.log('\n🎯 Тестирование интеграции завершено!');
}

function makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname,
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
testIntegration().catch(console.error);


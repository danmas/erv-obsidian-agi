// Тест создания задачи через API Агента
const http = require('http');

async function testCreateTask() {
    console.log('🧪 Тестирование создания задачи через API...\n');

    const taskData = JSON.stringify({
        taskTitle: 'Тестовая задача через API Агента',
        context: 'Это тестовая задача для проверки работы API Агента'
    });

    try {
        console.log('📤 Отправляем запрос на создание задачи...');

        const response = await makeRequest('/api/agent/create-task', 'POST', taskData);
        const result = JSON.parse(response);

        if (result.success) {
            if (result.type === 'questions') {
                console.log('❓ Агент запросил уточнения:');
                result.questions.forEach((q, i) => {
                    console.log(`   ${i + 1}. ${q}`);
                });
                console.log(`\n📝 Черновик создан: ${result.path}`);
            } else {
                console.log('✅ Задача создана успешно!');
                console.log(`📋 План: ${result.task.steps.length} шагов`);
                console.log(`📁 Файл: ${result.task.path}`);
                console.log(`🆔 ID: ${result.task.taskId}`);
            }
        } else {
            console.log('❌ Ошибка создания задачи:', result.error);
        }
    } catch (error) {
        console.log('❌ Ошибка запроса:', error.message);
    }

    console.log('\n🎯 Тестирование создания задачи завершено!');
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
testCreateTask().catch(console.error);



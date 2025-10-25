// Тест создания задачи через веб-интерфейс
const http = require('http');

async function testCreateTaskWeb() {
    console.log('🧪 Тестирование создания задачи через веб-интерфейс...\n');

    const taskData = JSON.stringify({
        taskTitle: 'Тестовая задача через веб-интерфейс'
    });

    try {
        console.log('📤 Отправляем запрос на создание задачи через веб-интерфейс...');

        const response = await makeRequest('http://localhost:3013/api/agent/generate-plan', 'POST', taskData);
        const result = JSON.parse(response);

        if (result.success) {
            if (result.type === 'questions') {
                console.log('❓ Агент запросил уточнения:');
                result.questions.forEach((q, i) => {
                    console.log(`   ${i + 1}. ${q}`);
                });
            } else {
                console.log('✅ План сгенерирован:');
                console.log(`📋 Шаги: ${result.steps.length}`);
                result.steps.forEach((step, i) => {
                    console.log(`   ${i + 1}. ${step}`);
                });
            }
        } else {
            console.log('❌ Ошибка генерации плана:', result.error);
        }
    } catch (error) {
        console.log('❌ Ошибка запроса:', error.message);
    }

    console.log('\n🎯 Тестирование создания задачи завершено!');
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
testCreateTaskWeb().catch(console.error);


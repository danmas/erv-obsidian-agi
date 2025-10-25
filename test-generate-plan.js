// Тест генерации плана через API Агента (без создания файла)
const http = require('http');

async function testGeneratePlan() {
    console.log('🧪 Тестирование генерации плана через API...\n');

    const planData = JSON.stringify({
        taskTitle: 'Настроить веб-сервер для проекта',
        context: 'Нужно настроить Nginx для продакшена'
    });

    try {
        console.log('📤 Отправляем запрос на генерацию плана...');

        const response = await makeRequest('/api/agent/generate-plan', 'POST', planData);
        const result = JSON.parse(response);

        if (result.success) {
            if (result.type === 'questions') {
                console.log('❓ Агент запросил уточнения:');
                result.questions.forEach((q, i) => {
                    console.log(`   ${i + 1}. ${q}`);
                });
            } else {
                console.log('✅ План сгенерирован успешно!');
                console.log(`📋 Шаги (${result.steps.length}):`);
                result.steps.forEach((step, i) => {
                    console.log(`   ${i + 1}. ${step}`);
                });

                if (result.considerations) {
                    console.log(`\n💡 Соображения ИИ:`);
                    console.log(result.considerations);
                }
            }
        } else {
            console.log('❌ Ошибка генерации плана:', result.error);
        }
    } catch (error) {
        console.log('❌ Ошибка запроса:', error.message);
    }

    console.log('\n🎯 Тестирование генерации плана завершено!');
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
testGeneratePlan().catch(console.error);



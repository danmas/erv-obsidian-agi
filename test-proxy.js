// Тест прокси между веб-интерфейсом и Агент-сервером
const http = require('http');

async function testProxy() {
    console.log('🧪 Тестирование прокси между веб-интерфейсом и Агент-сервером...\n');

    // Тест 1: Проверка Агент-сервера напрямую
    console.log('1. Проверка Агент-сервера напрямую...');
    try {
        const agentResponse = await makeRequest('http://localhost:3012/api/agent/health');
        console.log('✅ Агент-сервер отвечает напрямую');
    } catch (error) {
        console.log('❌ Агент-сервер недоступен:', error.message);
        return;
    }

    // Тест 2: Проверка веб-интерфейса
    console.log('\n2. Проверка веб-интерфейса...');
    try {
        const webResponse = await makeRequest('http://localhost:3013/');
        console.log('✅ Веб-интерфейс отвечает');
    } catch (error) {
        console.log('❌ Веб-интерфейс недоступен:', error.message);
        return;
    }

    // Тест 3: Проверка прокси через веб-интерфейс
    console.log('\n3. Проверка прокси через веб-интерфейс...');
    try {
        const proxyResponse = await makeRequest('http://localhost:3013/api/agent/health');
        console.log('✅ Прокси работает - Агент-сервер доступен через веб-интерфейс');
    } catch (error) {
        console.log('❌ Прокси не работает:', error.message);
    }

    console.log('\n🎯 Тестирование завершено!');
}

function makeRequest(url, method = 'GET') {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname,
            method: method
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
        req.end();
    });
}

// Запускаем тестирование
testProxy().catch(console.error);


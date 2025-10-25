const axios = require('axios');

async function testCreateTask() {
    console.log('\n🧪 Тестирование API создания задачи...\n');

    try {
        // Тест 1: Создание задачи с контекстом (должен вернуть план)
        console.log('📝 Тест 1: Создание задачи с контекстом');
        const response1 = await axios.post('http://localhost:3012/api/agent/create-task', {
            taskTitle: 'Добавить логирование в проект',
            context: 'Node.js проект, нужно логировать запросы к API и ошибки. Использовать winston.'
        });

        console.log('✅ Результат:', JSON.stringify(response1.data, null, 2));
        console.log('');

        // Тест 2: Генерация плана без создания файла
        console.log('📝 Тест 2: Генерация плана');
        const response2 = await axios.post('http://localhost:3012/api/agent/generate-plan', {
            taskTitle: 'Установить зависимости проекта'
        });

        console.log('✅ Результат:', JSON.stringify(response2.data, null, 2));
        console.log('');

        // Тест 3: Получение списка задач
        console.log('📝 Тест 3: Получение списка задач');
        const response3 = await axios.get('http://localhost:3012/api/agent/tasks');

        console.log(`✅ Найдено задач: ${response3.data.length}`);
        console.log('Первые 3 задачи:');
        response3.data.slice(0, 3).forEach(task => {
            console.log(`  - ${task.filename} (${task.status})`);
        });
        console.log('');

        console.log('✅ Все тесты пройдены успешно!\n');

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        if (error.response) {
            console.error('Ответ сервера:', error.response.data);
        }
    }
}

testCreateTask();



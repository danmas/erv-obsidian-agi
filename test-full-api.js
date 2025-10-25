const axios = require('axios');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFullAPI() {
    console.log('\n🧪 Полное тестирование API сервера агента\n');
    console.log('=' .repeat(60));

    try {
        // Ждем немного чтобы сервер точно запустился
        await sleep(1000);

        // Тест 1: Health Check
        console.log('\n📝 Тест 1: Health Check');
        console.log('-'.repeat(60));
        const health = await axios.get('http://localhost:3012/api/agent/health');
        console.log('✅ Статус:', health.data.status);
        console.log('✅ Версия:', health.data.version);

        // Тест 2: Создание задачи с контекстом
        console.log('\n📝 Тест 2: Создание задачи с контекстом');
        console.log('-'.repeat(60));
        const createTask = await axios.post('http://localhost:3012/api/agent/create-task', {
            taskTitle: 'Настроить мониторинг приложения',
            context: 'Node.js приложение. Нужен мониторинг CPU, памяти и времени ответа API. Использовать Prometheus.'
        });

        if (createTask.data.success) {
            console.log('✅ Тип:', createTask.data.type);
            if (createTask.data.type === 'task') {
                console.log('✅ Путь:', createTask.data.task.path);
                console.log('✅ Шагов в плане:', createTask.data.task.steps.length);
                console.log('\nПервые 3 шага:');
                createTask.data.task.steps.slice(0, 3).forEach((step, idx) => {
                    console.log(`   ${idx + 1}. ${step}`);
                });
            } else if (createTask.data.type === 'questions') {
                console.log('❓ Требуются уточнения:', createTask.data.questions.length, 'вопросов');
            }
        }

        // Тест 3: Генерация плана без создания файла
        console.log('\n📝 Тест 3: Генерация плана без создания файла');
        console.log('-'.repeat(60));
        const generatePlan = await axios.post('http://localhost:3012/api/agent/generate-plan', {
            taskTitle: 'Обновить README проекта',
            context: 'Добавить примеры использования API, описание архитектуры и инструкции по развертыванию.'
        });

        if (generatePlan.data.success) {
            console.log('✅ Тип:', generatePlan.data.type);
            if (generatePlan.data.type === 'plan') {
                console.log('✅ Шагов:', generatePlan.data.steps.length);
                console.log('\nШаги:');
                generatePlan.data.steps.forEach((step, idx) => {
                    console.log(`   ${idx + 1}. ${step}`);
                });
                if (generatePlan.data.considerations) {
                    console.log('\n💡 Соображения:');
                    console.log('  ', generatePlan.data.considerations);
                }
            }
        }

        // Тест 4: Получение списка задач
        console.log('\n📝 Тест 4: Получение списка задач');
        console.log('-'.repeat(60));
        const tasks = await axios.get('http://localhost:3012/api/agent/tasks');
        console.log('✅ Всего задач:', tasks.data.length);
        
        const pendingTasks = tasks.data.filter(t => t.status === 'pending');
        const questionTasks = tasks.data.filter(t => t.status === 'questions');
        
        console.log('📊 Статистика:');
        console.log('   - В ожидании:', pendingTasks.length);
        console.log('   - Требуют уточнений:', questionTasks.length);
        
        console.log('\nПоследние 5 задач:');
        tasks.data.slice(0, 5).forEach(task => {
            const statusEmoji = task.status === 'pending' ? '⏳' : 
                               task.status === 'questions' ? '❓' : '✅';
            console.log(`   ${statusEmoji} ${task.title || task.filename}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ ОШИБКА:', error.message);
        if (error.response) {
            console.error('Статус:', error.response.status);
            console.error('Данные:', error.response.data);
        }
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Подсказка: Убедитесь что сервер агента запущен (node agent-server.js)');
        }
        process.exit(1);
    }
}

// Запускаем тесты
testFullAPI();



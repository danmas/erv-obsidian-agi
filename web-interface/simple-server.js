const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('Сервер работает!');
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'API работает!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Простой сервер запущен на http://localhost:${PORT}`);
});

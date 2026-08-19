require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');

const sessoesRoutes = require('./service/sessoes');
const metricasRoutes = require('./service/metricas');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/sessoes', sessoesRoutes);
app.use('/api/metricas', metricasRoutes);

app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            db: 'connected'
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            db: 'disconnected',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
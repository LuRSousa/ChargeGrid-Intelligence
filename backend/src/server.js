require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const sessoesRoutes = require('./routes/sessoes');
const carregadoresRoutes = require('./routes/carregadores');
const pagamentoRoutes = require('./routes/pagamento');
const rfidsRoutes = require('./routes/rfids');
const usuarioRoutes = require('./routes/usuario');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Arquivos estáticos (PWA + dashboard)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'tela-cliente')));
app.use('/dashboard', express.static(path.join(__dirname, '..', '..', 'frontend', 'tela-operador')));

app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/dashboard', (req, res) => res.redirect('/dashboard/dashboard.html'));

// Rotas da API
app.use('/api/sessoes', sessoesRoutes);
app.use('/api/carregadores', carregadoresRoutes);
app.use('/api/pagamento', pagamentoRoutes);
app.use('/api/rfids', rfidsRoutes);
app.use('/api/usuario', usuarioRoutes);

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
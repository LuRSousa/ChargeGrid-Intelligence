const db = require('../db');

class FaturaModel{
    //Cria uma nova fatura para uma sessão encerrada
    //Retorna {Object} Fatura criada
    static async criar(dados) {
        const { sessao_id, usuario_id, valor_total, desconto_aplicado } = dados;

        // Verifica se já existe fatura para esta sessão
        const existente = await this.buscarPorSessao(sessao_id);
        if (existente) {
            throw new Error(`Já existe uma fatura para a sessão ${sessao_id}`);
        }

        const [result] = await db.query(
            `INSERT INTO Faturas 
             (sessao_id, usuario_id, valor_total, desconto_aplicado, status_pagamento, data_emissao) 
             VALUES (?, ?, ?, ?, 'pendente', NOW())`,
            [sessao_id, usuario_id || null, valor_total, desconto_aplicado || 0]
        );

        return this.buscarPorId(result.insertId);
    }

    //Busca uma fatura pelo ID
    //Retorna {Object} Fatura ou null
    static async buscarPorId(id) {
        const [rows] = await db.query(
            `SELECT f.*, 
                    s.id AS sessao_id,
                    s.energia_kwh,
                    s.duracao_minutos,
                    s.modo_carga,
                    u.nome AS usuario_nome,
                    c.modelo AS carregador_modelo
             FROM Faturas f
             JOIN Sessoes s ON f.sessao_id = s.id
             LEFT JOIN Usuarios u ON f.usuario_id = u.id
             LEFT JOIN Carregadores c ON s.carregador_id = c.id
             WHERE f.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    //Busca uma fatura pelo ID da sessão
    //Retorna {Object} Fatura ou null
    static async buscarPorSessao(sessaoId) {
        const [rows] = await db.query(
            `SELECT * FROM Faturas WHERE sessao_id = ?`,
            [sessaoId]
        );
        return rows[0] || null;
    }

    //Busca faturas de um usuário
    //Retorna {Array} Lista de faturas
    static async buscarPorUsuario(usuarioId, status = null) {
        let query = `SELECT * FROM Faturas WHERE usuario_id = ?`;
        const params = [usuarioId];
        if (status) {
            query += ` AND status_pagamento = ?`;
            params.push(status);
        }
        query += ` ORDER BY data_emissao DESC`;
        const [rows] = await db.query(query, params);
        return rows;
    }

    //Busca faturas pendentes
    //Retorna {Array} Lista de faturas pendentes
    static async buscarPendentes() {
        const [rows] = await db.query(
            `SELECT f.*, 
                    s.energia_kwh,
                    s.duracao_minutos,
                    u.nome AS usuario_nome
             FROM Faturas f
             JOIN Sessoes s ON f.sessao_id = s.id
             LEFT JOIN Usuarios u ON f.usuario_id = u.id
             WHERE f.status_pagamento = 'pendente'
             ORDER BY f.data_emissao ASC`
        );
        return rows;
    }

    //Busca faturas pagas
    //Retorna {Array} Lista de faturas pagas
    static async buscarPagas(limit = 100) {
        const [rows] = await db.query(
            `SELECT f.*, 
                    s.energia_kwh,
                    s.duracao_minutos,
                    u.nome AS usuario_nome
             FROM Faturas f
             JOIN Sessoes s ON f.sessao_id = s.id
             LEFT JOIN Usuarios u ON f.usuario_id = u.id
             WHERE f.status_pagamento = 'pago'
             ORDER BY f.data_pagamento DESC
             LIMIT ?`,
            [limit]
        );
        return rows;
    }

    //Busca todas as faturas
    //Retorna {Array} Lista de faturas
    static async buscarTodas(limit = 100, offset = 0) {
        const [rows] = await db.query(
            `SELECT f.*, 
                    s.energia_kwh,
                    u.nome AS usuario_nome
             FROM Faturas f
             JOIN Sessoes s ON f.sessao_id = s.id
             LEFT JOIN Usuarios u ON f.usuario_id = u.id
             ORDER BY f.data_emissao DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return rows;
    }

    //Marca fatura como paga
    //Retorna {Object} Fatura atualizada
    static async marcarPaga(id, metodoPagamento, transacaoExternaId = null) {
        // Busca a fatura para verificar se existe
        const fatura = await this.buscarPorId(id);
        if (!fatura) {
            throw new Error(`Fatura ${id} não encontrada`);
        }

        if (fatura.status_pagamento === 'pago') {
            throw new Error(`Fatura ${id} já está paga`);
        }

        await db.query(
            `UPDATE Faturas 
             SET status_pagamento = 'pago', 
                 metodo_pagamento = ?, 
                 transacao_externa_id = ?,
                 data_pagamento = NOW()
             WHERE id = ?`,
            [metodoPagamento, transacaoExternaId || null, id]
        );

        // Atualizar a sessão associada para 'paga'
        const SessaoModel = require('./SessaoModel');
        await SessaoModel.atualizarStatus(fatura.sessao_id, 'paga');

        return this.buscarPorId(id);
    }

    //Cancela uma fatura (se estiver pendente)
    static async cancelar(id, motivo = null) {
        const fatura = await this.buscarPorId(id);
        if (!fatura) {
            throw new Error(`Fatura ${id} não encontrada`);
        }

        if (fatura.status_pagamento === 'pago') {
            throw new Error(`Fatura ${id} já está paga e não pode ser cancelada`);
        }

        await db.query(
            `UPDATE Faturas SET status_pagamento = 'cancelado' WHERE id = ?`,
            [id]
        );
        return this.buscarPorId(id);
    }

    //Retorna o faturamento total do período
    //Retorna {Object} { total, quantidade, media }
    static async getFaturamentoPeriodo(dataInicio, dataFim) {
        const [rows] = await db.query(
            `SELECT 
                SUM(valor_total) AS total,
                COUNT(*) AS quantidade,
                AVG(valor_total) AS media
             FROM Faturas
             WHERE status_pagamento = 'pago'
               AND data_pagamento BETWEEN ? AND ?`,
            [dataInicio, dataFim]
        );
        return {
            total: parseFloat(rows[0]?.total) || 0,
            quantidade: parseInt(rows[0]?.quantidade) || 0,
            media: parseFloat(rows[0]?.media) || 0
        };
    }

    //Retorna faturamente agrupado por dia
    //Retorna {Array} [{ data, total }]
    static async getFaturamentoPorDia(dias = 7) {
        const [rows] = await db.query(
            `SELECT 
                DATE(data_pagamento) AS data,
                SUM(valor_total) AS total,
                COUNT(*) AS quantidade
             FROM Faturas
             WHERE status_pagamento = 'pago'
               AND data_pagamento >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE(data_pagamento)
             ORDER BY data ASC`,
            [dias]
        );
        return rows;
    }

    //Estátisticas financeiras gerais
    //Retorna {Object} { total_faturas, total_pago, total_pendente, total_cancelado }
    static async getEstatisticas() {
        const [rows] = await db.query(
            `SELECT 
                COUNT(*) AS total_faturas,
                SUM(CASE WHEN status_pagamento = 'pago' THEN valor_total ELSE 0 END) AS total_pago,
                SUM(CASE WHEN status_pagamento = 'pendente' THEN valor_total ELSE 0 END) AS total_pendente,
                SUM(CASE WHEN status_pagamento = 'cancelado' THEN valor_total ELSE 0 END) AS total_cancelado,
                COUNT(CASE WHEN status_pagamento = 'pendente' THEN 1 END) AS pendentes,
                COUNT(CASE WHEN status_pagamento = 'pago' THEN 1 END) AS pagas,
                COUNT(CASE WHEN status_pagamento = 'cancelado' THEN 1 END) AS canceladas
             FROM Faturas`
        );
        return {
            total_faturas: parseInt(rows[0]?.total_faturas) || 0,
            total_pago: parseFloat(rows[0]?.total_pago) || 0,
            total_pendente: parseFloat(rows[0]?.total_pendente) || 0,
            total_cancelado: parseFloat(rows[0]?.total_cancelado) || 0,
            pendentes: parseInt(rows[0]?.pendentes) || 0,
            pagas: parseInt(rows[0]?.pagas) || 0,
            canceladas: parseInt(rows[0]?.canceladas) || 0
        };
    }

    //Busca uma fatura pelo ID da transação externa (gateway)
    //Retorna {Object} Fatura ou null
    static async buscarPorTransacaoExterna(transacaoExternaId) {
        const [rows] = await db.query(
            `SELECT * FROM Faturas WHERE transacao_externa_id = ?`,
            [transacaoExternaId]
        );
        return rows[0] || null;
    }
}

module.exports = FaturaModel;
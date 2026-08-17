const db = require('../db');

class SessaoModel{
    //Cria uma nova sessão de recarga com dados {carregador_id, cartao_rfid_uid, usuario_id, modo_carga, potencia_atual}
    //Retorna {Object} Sessão criada
    static async criar(dados) {
        const { carregador_id, cartao_rfid_uid, usuario_id, modo_carga, potencia_atual } = dados;

        const [result] = await db.query(
            `INSERT INTO Sessoes 
             (carregador_id, cartao_rfid_uid, usuario_id, inicio_recarga, sessao_status, modo_carga, potencia_media) 
             VALUES (?, ?, ?, NOW(), 'carregando', ?, ?)`,
            [carregador_id, cartao_rfid_uid, usuario_id || null, modo_carga || 'FV', potencia_atual || 0]
        );

        return this.buscarPorId(result.insertId);
    }

    //Busca uma sessão pelo ID
    //Retorna {Object} Sessão completa
    static async buscarPorId(id) {
        const [rows] = await db.query(
            `SELECT s.*, 
                    c.modelo AS carregador_modelo, 
                    c.numero_serie AS carregador_sn,
                    u.nome AS usuario_nome
             FROM Sessoes s
             LEFT JOIN Carregadores c ON s.carregador_id = c.id
             LEFT JOIN Usuarios u ON s.usuario_id = u.id
             WHERE s.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    //Busca sessão ativa por RFID
    //Retorna {Object} Sessão ou null
    static async buscarAtivaPorRFID(rfidUid) {
        const [rows] = await db.query(
            `SELECT s.*, 
                    c.modelo AS carregador_modelo,
                    c.potencia_maxima,
                    u.nome AS usuario_nome,
                    u.plano,
                    u.desconto_percentual
             FROM Sessoes s
             LEFT JOIN Carregadores c ON s.carregador_id = c.id
             LEFT JOIN Usuarios u ON s.usuario_id = u.id
             WHERE s.cartao_rfid_uid = ? 
               AND s.sessao_status = 'carregando'
             ORDER BY s.inicio_recarga DESC
             LIMIT 1`,
            [rfidUid]
        );
        return rows[0] || null;
    }

    //Busca todas as sessões ativas (status = 'carregando')
    //Retorna {Array} Lista de sessões ativas
    static async buscarTodasAtivas() {
        const [rows] = await db.query(
            `SELECT s.*, 
                    c.potencia_maxima,
                    c.potencia_atual AS carregador_potencia_atual
             FROM Sessoes s
             JOIN Carregadores c ON s.carregador_id = c.id
             WHERE s.sessao_status = 'carregando'
             ORDER BY s.inicio_recarga ASC`
        );
        return rows;
    }

    //Calcula a demanda total e quantidade de sessões ativas
    //Retorna {Object} { demanda_total, qnt_sessoes }
    static async getDemandaTotal() {
        const [rows] = await db.query(
            `SELECT 
                SUM(c.potencia_atual) AS demanda_total,
                COUNT(*) AS qnt_sessoes
             FROM Sessoes s
             JOIN Carregadores c ON s.carregador_id = c.id
             WHERE s.sessao_status = 'carregando'`
        );
        return {
            demanda_total: parseFloat(rows[0]?.demanda_total) || 0,
            qnt_sessoes: parseInt(rows[0]?.qnt_sessoes) || 0
        };
    }

    //Atualiza a potência de uma sessão em andamento
    //Retorna {Object} Sessão atualizada
    static async atualizarPotencia(id, novaPotencia) {
        await db.query(
            `UPDATE Sessoes 
             SET potencia_media = ?, atualizada_em = NOW()
             WHERE id = ? AND sessao_status = 'carregando'`,
            [novaPotencia, id]
        );
        return this.buscarPorId(id);
    }

    //Encerra uma sessão (calcula tudo)
    //Retorna {Object} Sessão encerrad
    static async encerrar(id, dadosFinais) {
        const { duracao_minutos, energia_kwh, tarifa_aplicada, custo_total } = dadosFinais;

        await db.query(
            `UPDATE Sessoes 
             SET fim_recarga = NOW(),
                 duracao_minutos = ?,
                 energia_kwh = ?,
                 tarifa_aplicada = ?,
                 custo_total = ?,
                 sessao_status = 'encerrada',
                 atualizada_em = NOW()
             WHERE id = ?`,
            [duracao_minutos, energia_kwh, tarifa_aplicada, custo_total, id]
        );

        return this.buscarPorId(id);
    }

    //Atualiza o status da sessão (ex: para 'paga')
    //Retorna {string} novoStatus
    static async atualizarStatus(id, novoStatus) {
        await db.query(
            `UPDATE Sessoes 
             SET sessao_status = ?, atualizada_em = NOW()
             WHERE id = ?`,
            [novoStatus, id]
        );
        return this.buscarPorId(id);
    }
}

module.exports = SessaoModel;
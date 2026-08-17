const db = require('../db');

class RFIDModel{
    //Busca um cartão RFID pelo UID
    //Retorna {Object} Cartão ou null
    static async buscarPorUID(uid) {
        const [rows] = await db.query(
            `SELECT * FROM Cartoes_rfid WHERE cartao_rfid_uid = ?`,
            [uid]
        );
        return rows[0] || null;
    }

    //Busca todos os cartões RFID
    //Retorna {Array} Lista de cartões
    static async buscarTodos(status = null) {
        let query = `SELECT * FROM Cartoes_rfid`;
        const params = [];
        if (status) {
            query += ` WHERE status_cartao_rfid = ?`;
            params.push(status);
        }
        query += ` ORDER BY criado_em DESC`;
        const [rows] = await db.query(query, params);
        return rows;
    }

    //Busca todos os cartões disponíveis (em estoque)
    //Retorna {Array} Lista de cartões disponíveis
    static async buscarDisponiveis() {
        const [rows] = await db.query(
            `SELECT * FROM Cartoes_rfid 
             WHERE status_cartao_rfid = 'estoque' 
             ORDER BY criado_em ASC`
        );
        return rows;
    }

    //Busca cartões em uso
    //Retorna {Array} Lista de cartões em uso
    static async buscarEmUso() {
        const [rows] = await db.query(
            `SELECT * FROM Cartoes_rfid 
             WHERE status_cartao_rfid = 'em_uso' 
             ORDER BY criado_em DESC`
        );
        return rows;
    }

    //Atualiza o status do cartão
    static async atualizarStatus(uid, novoStatus) {
        await db.query(
            `UPDATE Cartoes_rfid SET status_cartao_rfid = ? WHERE cartao_rfid_uid = ?`,
            [novoStatus, uid]
        );
        return this.buscarPorUID(uid);
    }

    //Altera o status para 'em_uso' (quando uma sessão inicia)
    static async marcarComoEmUso(uid) {
        return this.atualizarStatus(uid, 'em_uso');
    }

    //Altera o status para 'estoque' (quando uma sessão termina)
    static async marcarComoDisponivel(uid) {
        return this.atualizarStatus(uid, 'estoque');
    }

    //Bloqueia um cartão RFID (permanente)
    static async bloquear(uid) {
        return this.atualizarStatus(uid, 'bloqueado');
    }

    //Cadastra um novo cartão RFID
    //Retorna {Object} Cartão criado
    static async cadastrar(uid, status = 'estoque') {
        // Verifica se o cartão já existe
        const existente = await this.buscarPorUID(uid);
        if (existente) {
            throw new Error(`Cartão RFID ${uid} já está cadastrado`);
        }

        await db.query(
            `INSERT INTO Cartoes_rfid (cartao_rfid_uid, status_cartao_rfid) VALUES (?, ?)`,
            [uid, status]
        );
        return this.buscarPorUID(uid);
    }

    //Remove um cartão RFID (apenas se estiver em estoque)
    static async remover(uid) {
        const cartao = await this.buscarPorUID(uid);
        if (!cartao) {
            throw new Error(`Cartão RFID ${uid} não encontrado`);
        }
        if (cartao.status_cartao_rfid !== 'estoque') {
            throw new Error(`Cartão RFID ${uid} não pode ser removido (está em uso ou bloqueado)`);
        }
        await db.query(
            `DELETE FROM Cartoes_rfid WHERE cartao_rfid_uid = ? AND status_cartao_rfid = 'estoque'`,
            [uid]
        );
        return { sucesso: true, mensagem: `Cartão ${uid} removido` };
    }

    //Retorna estatísticas dos cartões RFID
    //Retorna {Object} { total, em_uso, estoque, bloqueado }
    static async getEstatisticas() {
        const [total] = await db.query(`SELECT COUNT(*) AS total FROM Cartoes_rfid`);
        const [emUso] = await db.query(`SELECT COUNT(*) AS total FROM Cartoes_rfid WHERE status_cartao_rfid = 'em_uso'`);
        const [estoque] = await db.query(`SELECT COUNT(*) AS total FROM Cartoes_rfid WHERE status_cartao_rfid = 'estoque'`);
        const [bloqueado] = await db.query(`SELECT COUNT(*) AS total FROM Cartoes_rfid WHERE status_cartao_rfid = 'bloqueado'`);
        
        return {
            total: parseInt(total[0]?.total) || 0,
            em_uso: parseInt(emUso[0]?.total) || 0,
            estoque: parseInt(estoque[0]?.total) || 0,
            bloqueado: parseInt(bloqueado[0]?.total) || 0
        };
    }
}

module.exports = RFIDModel;
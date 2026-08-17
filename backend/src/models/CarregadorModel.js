const db = require('../db');

class CarregadorModel{
    //Busca um carregador pelo ID
    //Retorna {Object} Carregador ou null
    static async buscarPorId(id) {
        const [rows] = await db.query(
            `SELECT * FROM Carregadores WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    //Busca todos os carregadores cadastrados
    //Retorna {Array} Lista de carregadores
    static async buscarTodos(status = null) {
        let query = `SELECT * FROM Carregadores`;
        const params = [];
        if (status) {
            query += ` WHERE status_modbus = ?`;
            params.push(status);
        }
        query += ` ORDER BY id`;
        const [rows] = await db.query(query, params);
        return rows;
    }

    //Busca todos os carregadores ativos (em uso ou aguardando)
    //Retorna {Array} Lista de carregadores ativos
    static async buscarAtivos() {
        const [rows] = await db.query(
            `SELECT * FROM Carregadores 
             WHERE status_modbus IN ('em_uso', 'aguardando_inicio_sessao')
             ORDER BY id`
        );
        return rows;
    }

    //Calcula a soma das potências máximas de todos os carregadores
    //Retorna {number} Potência total máxima (kW)
    static async getPotenciaTotalMaxima() {
        const [rows] = await db.query(
            `SELECT SUM(potencia_maxima) AS total_maxima 
             FROM Carregadores`
        );
        return parseFloat(rows[0]?.total_maxima) || 0;
    }

    //Calcula a soma das potências atuais de todos os carregadores
    //Retorna {number} Potência total atual (kW)
    static async getPotenciaTotalAtual() {
        const [rows] = await db.query(
            `SELECT SUM(potencia_atual) AS total_atual 
             FROM Carregadores 
             WHERE status_modbus = 'em_uso'`
        );
        return parseFloat(rows[0]?.total_atual) || 0;
    }

    //Atualiza o status de um carregador
    static async atualizarStatus(id, status) {
        await db.query(
            `UPDATE Carregadores 
             SET status_modbus = ? 
             WHERE id = ?`,
            [status, id]
        );
        return this.buscarPorId(id);
    }

    //Atualiza a potência atual de um carregador
    static async atualizarPotencia(id, potenciaAtual) {
        await db.query(
            `UPDATE Carregadores 
             SET potencia_atual = ? 
             WHERE id = ?`,
            [potenciaAtual, id]
        );
        return this.buscarPorId(id);
    }

    //Atualiza status e potência juntos (para início/fim de sessão)
    static async atualizarStatusEPotencia(id, status, potenciaAtual = null) {
        let query = `UPDATE Carregadores SET status_modbus = ?`;
        const params = [status];
        
        if (potenciaAtual !== null) {
            query += `, potencia_atual = ?`;
            params.push(potenciaAtual);
        }
        
        query += ` WHERE id = ?`;
        params.push(id);
        
        await db.query(query, params);
        return this.buscarPorId(id);
    }

    //Cria um novo carregador
    //Retorna {Object} Carregador criado
    static async criar(dados) {
        const { numero_serie, modelo, localizacao, potencia_maxima, endereco_ip, porta_modbus } = dados;
        
        const [result] = await db.query(
            `INSERT INTO Carregadores 
             (numero_serie, modelo, localizacao, potencia_maxima, endereco_ip, porta_modbus, status_modbus) 
             VALUES (?, ?, ?, ?, ?, ?, 'ocioso')`,
            [numero_serie, modelo, localizacao, potencia_maxima || null, endereco_ip || null, porta_modbus || 502]
        );
        return this.buscarPorId(result.insertId);
    }

    //Busca carregadores com problemas (status = 'erro')
    //Retorna {Array} Lista de carregadores em erro
    static async buscarEmErro() {
        const [rows] = await db.query(
            `SELECT * FROM Carregadores WHERE status_modbus = 'erro'`
        );
        return rows;
    }

    //Reseta todos os carregadores para status 'ocioso' e potência 0
    static async resetarTodos() {
        await db.query(
            `UPDATE Carregadores 
             SET status_modbus = 'ocioso', potencia_atual = 0`
        );
    }
}

module.exports = CarregadorModel;
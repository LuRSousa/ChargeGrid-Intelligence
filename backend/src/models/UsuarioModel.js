const db = require('../db');
const bcryptjs = require('bcryptjs'); // Para hash de senha

class UsuarioModel{
    //Busca um usuário pelo ID
    //Retorna {Object} Usuário ou null
    static async buscarPorId(id) {
        const [rows] = await db.query(
            `SELECT id, nome, email, tipo_conta, plano, desconto_percentual, criado_em 
             FROM Usuarios 
             WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    //Busca um usuário pelo email (para login)
    //Retorna {Object} Usuário completo (com senha_hash)
    static async buscarPorEmail(email) {
        const [rows] = await db.query(
            `SELECT * FROM Usuarios WHERE email = ?`,
            [email]
        );
        return rows[0] || null;
    }

    //Busca um usuário pelo nome (parcial, para busca)
    //Retorna {Array} Lista de usuários
    static async buscarPorNome(nome) {
        const [rows] = await db.query(
            `SELECT id, nome, email, tipo_conta, plano, desconto_percentual 
             FROM Usuarios 
             WHERE nome LIKE ? 
             ORDER BY nome`,
            [`%${nome}%`]
        );
        return rows;
    }

    //Busca todos os usuários
    //Retorna {Array} Lista de usuários
    static async buscarTodos(limit = 100, offset = 0) {
        const [rows] = await db.query(
            `SELECT id, nome, email, tipo_conta, plano, desconto_percentual, criado_em 
             FROM Usuarios 
             ORDER BY nome 
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return rows;
    }

    //Cria um novo usuário
    //Retorna {Object} Usuário criado
    static async criar(dados) {
        const { nome, email, senha_hash, tipo_conta, plano, desconto_percentual } = dados;
        
        // Verifica se o email já existe
        const existente = await this.buscarPorEmail(email);
        if (existente) {
            throw new Error('Email já cadastrado');
        }

        const [result] = await db.query(
            `INSERT INTO Usuarios 
             (nome, email, senha_hash, tipo_conta, plano, desconto_percentual) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                nome, 
                email, 
                senha_hash, 
                tipo_conta || 'cliente', 
                plano || 'padrao', 
                desconto_percentual || 0
            ]
        );
        return this.buscarPorId(result.insertId);
    }

    //Atualiza um usuário
    //Retorna {Object} Usuário atualizado
    static async atualizar(id, dados) {
        const { nome, email, tipo_conta, plano, desconto_percentual } = dados;
        
        // Verifica se o usuário existe
        const usuario = await this.buscarPorId(id);
        if (!usuario) {
            throw new Error('Usuário não encontrado');
        }

        // Verifica se o novo email já está em uso por outro usuário
        if (email) {
            const existente = await this.buscarPorEmail(email);
            if (existente && existente.id !== id) {
                throw new Error('Email já está em uso por outro usuário');
            }
        }

        await db.query(
            `UPDATE Usuarios 
             SET nome = COALESCE(?, nome),
                 email = COALESCE(?, email),
                 tipo_conta = COALESCE(?, tipo_conta),
                 plano = COALESCE(?, plano),
                 desconto_percentual = COALESCE(?, desconto_percentual)
             WHERE id = ?`,
            [nome, email, tipo_conta, plano, desconto_percentual, id]
        );
        return this.buscarPorId(id);
    }

    //Atualiza a senha de um usuário
    static async atualizarSenha(id, novaSenhaHash) {
        await db.query(
            `UPDATE Usuarios SET senha_hash = ? WHERE id = ?`,
            [novaSenhaHash, id]
        );
        return this.buscarPorId(id);
    }

    //Verifica as credenciais de um usuário (login)
    //Retorna {Object} Usuário ou null
    static async verificarCredenciais(email, senha) {
        const usuario = await this.buscarPorEmail(email);
        if (!usuario) {
            return null;
        }

        // Comparação de senha (bcryptjs)
        const senhaCorreta = await bcryptjs.compare(senha, usuario.senha_hash);
        if (!senhaCorreta) {
            return null;
        }

        // Retorna o usuário sem a senha
        delete usuario.senha_hash;
        return usuario;
    }

    //Busca operadores (para listar atendentes)
    //Retorna {Array} Lista de operadores
    static async buscarOperadores() {
        const [rows] = await db.query(
            `SELECT id, nome, email, plano, desconto_percentual 
             FROM Usuarios 
             WHERE tipo_conta = 'operador'
             ORDER BY nome`
        );
        return rows;
    }

    //Busca clientes (para listar usuários comuns)
    //Retorna {Array} Lista de clientes
    static async buscarClientes() {
        const [rows] = await db.query(
            `SELECT id, nome, email, plano, desconto_percentual 
             FROM Usuarios 
             WHERE tipo_conta = 'cliente'
             ORDER BY nome`
        );
        return rows;
    }
}

module.exports = UsuarioModel;
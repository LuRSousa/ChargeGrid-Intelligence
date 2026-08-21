const express = require('express');
const router = express.Router();

const UsuarioModel = require('../models/UsuarioModel');
const bcryptjs = require('bcryptjs');

// ==========================================
// 1. ROTAS GET (Consultas e Filtros Fixos)
// ==========================================

// GET /api/usuario - Lista todos com paginação
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const usuarios = await UsuarioModel.buscarTodos(limit, offset);

        return res.status(200).json(usuarios);
    } catch (error) {
        return res.status(500).json({
            erro: "Erro ao buscar todos os usuários.",
            detalhe: error.message
        });
    }
});

// GET /api/usuario/buscar-nome - Busca por nome via Query Param
router.get("/buscar-nome", async (req, res) => {
    try {
        const { nome } = req.query;

        if (!nome) {
            return res.status(400).json({ 
                mensagem: "O parâmetro de busca 'nome' é obrigatório na URL. Exemplo: /buscar-nome?nome=Caio" 
            });
        }

        const usuarios = await UsuarioModel.buscarPorNome(nome);

        return res.status(200).json(usuarios);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao buscar usuários pelo nome.", 
            detalhe: error.message 
        });
    }
});

// GET /api/usuario/operadores - Lista apenas os operadores
router.get('/operadores', async (req, res) => {
    try {
        const operadores = await UsuarioModel.buscarOperadores();

        return res.status(200).json(operadores);
    } catch (error) {
        return res.status(500).json({
            erro: "Erro ao buscar a lista de operadores.",
            detalhe: error.message
        });
    }
});

// GET /api/usuario/clientes - Lista apenas os clientes
router.get('/clientes', async (req, res) => {
    try {
        const clientes = await UsuarioModel.buscarClientes();

        return res.status(200).json(clientes);
    } catch (error) {
        return res.status(500).json({
            erro: "Erro ao buscar a lista de clientes.",
            detalhe: error.message
        });
    }
});

// GET /api/usuario/:id - Busca por ID (Sempre por ÚLTIMO entre os GETs)
router.get('/:id', async (req, res) => {
    try {
        const usuario = await UsuarioModel.buscarPorId(req.params.id);

        if (!usuario) {
            return res.status(404).json({
                erro: 'Usuario nao encontrado'
            });
        }

        return res.status(200).json(usuario);

    } catch (erro) {
        console.error('Erro ao buscar usuario:', erro);

        return res.status(500).json({
            erro: 'Erro ao buscar usuario',
            detalhe: erro.message
        });
    }
});

// ==========================================
// 2. ROTAS POST (Criação, Buscas de Corpo e Login)
// ==========================================

// POST /api/usuario/criar-novo-usuario - Cria um novo usuário
router.post('/criar-novo-usuario', async (req, res) => {
    try {
        const { nome, email, senha, tipo_conta, plano, desconto_percentual } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ 
                mensagem: "Campos obrigatórios ausentes: 'nome', 'email' e 'senha' são necessários." 
            });
        }

        const salt = await bcryptjs.genSalt(10);
        const senha_hash = await bcryptjs.hash(senha, salt);

        const novoUsuario = await UsuarioModel.criar({
            nome,
            email,
            senha_hash,
            tipo_conta,
            plano,
            desconto_percentual
        });

        return res.status(201).json(novoUsuario);

    } catch (error) {
        if (error.message === 'Email já cadastrado') {
            return res.status(409).json({ mensagem: error.message });
        }

        return res.status(500).json({ 
            erro: "Erro ao criar usuário.", 
            detalhe: error.message 
        });
    }
});

// POST /api/usuario/buscar-email - Busca por e-mail no corpo da requisição
router.post("/buscar-email", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ mensagem: "O campo 'email' é obrigatório." });
        }

        const usuario = await UsuarioModel.buscarPorEmail(email);

        if (!usuario) {
            return res.status(404).json({ mensagem: `Usuário com o e-mail ${email} não foi encontrado.` });
        }

        return res.status(200).json(usuario);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao buscar usuário pelo e-mail.", 
            detalhe: error.message 
        });
    }
});

// POST /api/usuario/login - Valida o login do usuário
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ 
                mensagem: "Os campos 'email' e 'senha' são obrigatórios." 
            });
        }

        const usuario = await UsuarioModel.verificarCredenciais(email, senha);

        if (!usuario) {
            return res.status(401).json({ 
                mensagem: "E-mail ou senha inválidos." 
            });
        }

        return res.status(200).json({
            mensagem: "Login realizado com sucesso!",
            usuario
        });

    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao realizar login.", 
            detalhe: error.message 
        });
    }
});

// ==========================================
// 3. ROTAS PUT / PATCH (Atualizações)
// ==========================================

// PUT /api/usuario/atualizar/:id - Atualiza dados cadastrais
router.put('/atualizar/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, tipo_conta, plano, desconto_percentual } = req.body;

        const usuarioAtualizado = await UsuarioModel.atualizar(id, {
            nome,
            email,
            tipo_conta,
            plano,
            desconto_percentual
        });

        return res.status(200).json(usuarioAtualizado);

    } catch (error) {
        if (error.message === 'Usuário não encontrado') {
            return res.status(404).json({ mensagem: error.message });
        }

        if (error.message === 'Email já está em uso por outro usuário') {
            return res.status(409).json({ mensagem: error.message });
        }

        return res.status(500).json({ 
            erro: "Erro ao atualizar usuário.", 
            detalhe: error.message 
        });
    }
});

// PATCH /api/usuario/atualizar-senha/:id - Atualiza apenas a senha
router.patch('/atualizar-senha/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { novaSenha } = req.body;

        if (!novaSenha) {
            return res.status(400).json({ 
                mensagem: "O campo 'novaSenha' é obrigatório." 
            });
        }

        const salt = await bcryptjs.genSalt(10);
        const novaSenhaHash = await bcryptjs.hash(novaSenha, salt);

        const usuarioAtualizado = await UsuarioModel.atualizarSenha(id, novaSenhaHash);

        if (!usuarioAtualizado) {
            return res.status(404).json({ mensagem: "Usuário não encontrado." });
        }

        return res.status(200).json({
            mensagem: "Senha atualizada com sucesso!",
            usuario: usuarioAtualizado
        });

    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao atualizar a senha.", 
            detalhe: error.message 
        });
    }
});

module.exports = router;
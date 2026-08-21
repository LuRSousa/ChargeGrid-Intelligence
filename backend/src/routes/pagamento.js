const express = require("express");
const db = require("../db");
const FaturaModel = require("../models/FaturaModel");

const router = express.Router();
//feito
router.post("/criar/pagamento", async (req, res) => {
    try {
        const dados = req.body;

        const fatura = await FaturaModel.criar(dados);

        return res.status(201).json({
            sucesso: true,
            mensagem: "Fatura criada com sucesso",
            fatura: fatura
        });

    } catch (error) {
        const statusCode = error.message.includes("Já existe") ? 409 : 400;

        return res.status(statusCode).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});
//feito
router.get("/buscar/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const fatura = await FaturaModel.buscarPorId(id);

        if (!fatura) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Fatura não encontrada"
            });
        }

        res.status(200).json({
            sucesso: true,
            fatura: fatura
        });

    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});
//feito
router.get("/buscar/sessao/:sessaoId", async (req, res) => {
    try {
        const { sessaoId } = req.params;

        const fatura = await FaturaModel.buscarPorSessao(sessaoId);

        if (!fatura) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Fatura não encontrada para esta sessão"
            });
        }

        res.status(200).json({
            sucesso: true,
            fatura: fatura
        });

    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});
//feito
router.get("/buscar/usuario/:usuarioId", async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const { status } = req.query;

        const faturas = await FaturaModel.buscarPorUsuario(
            usuarioId,
            status
        );

        res.status(200).json({
            sucesso: true,
            faturas: faturas
        });

    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});
//feito
router.get("/pendente", async (req, res) => {
    try {
        const faturas = await FaturaModel.buscarPendentes();

        res.status(200).json({
            sucesso: true,
            faturas
        });

    } catch (error) {
        console.error("Erro ao buscar faturas pendentes:", error);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar faturas pendentes"
        });
    }
});
//feito
router.get("/pagas", async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;

        const faturas = await FaturaModel.buscarPagas(limit);

        res.status(200).json({
            sucesso: true,
            faturas
        });

    } catch (error) {
        console.error("Erro ao buscar faturas pagas:", error);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar faturas pagas"
        });
    }
});

//feito
router.get("/todas", async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;

        const faturas = await FaturaModel.buscarTodas(limit, offset);

        res.status(200).json({
            sucesso: true,
            total: faturas.length,
            faturas
        });

    } catch (error) {
        console.error("Erro ao buscar todas as faturas:", error);

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar faturas"
        });
    }
});
//feito
router.patch("/pagar/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { metodo_pagamento, transacao_externa_id } = req.body;

        if (!metodo_pagamento) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "O campo 'metodo_pagamento' é obrigatório"
            });
        }

        const faturaAtualizada = await FaturaModel.marcarPaga(
            id, 
            metodo_pagamento, 
            transacao_externa_id
        );

        res.status(200).json({
            sucesso: true,
            mensagem: "Pagamento registrado com sucesso",
            fatura: faturaAtualizada
        });

    } catch (error) {
        console.error("Erro ao registrar pagamento:", error);

        const statusCode = error.message.includes("não encontrada") ? 404 : 400;

        res.status(statusCode).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});
//feito
router.patch("/cancelar/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body || {};

        const faturaCancelada = await FaturaModel.cancelar(id, motivo);

        res.status(200).json({
            sucesso: true,
            mensagem: "Fatura cancelada com sucesso",
            fatura: faturaCancelada
        });

    } catch (error) {
        console.error("Erro ao cancelar fatura:", error);

        const statusCode = error.message.includes("não encontrada") ? 404 : 400;

        res.status(statusCode).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});
//FEITO
router.get('/faturamento', async (req, res) => {
    try {
        const { inicio, fim } = req.query;

        if (!inicio || !fim) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Por favor, informe os parâmetros 'inicio' e 'fim' no formato AAAA-MM-DD."
            });
        }

        const resultado = await FaturaModel.getFaturamentoPeriodo(inicio, fim);

        return res.status(200).json({
            sucesso: true,
            faturamento: resultado
        });

    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao calcular o faturamento do período.",
            erro: error.message
        });
    }
});
//feito
router.get('/faturamento/diario', async (req, res) => {
    try {

        const dias = parseInt(req.query.dias) || 7;

        const resultado = await FaturaModel.getFaturamentoPorDia(dias);

        return res.status(200).json({
            sucesso: true,
            dias_analisados: dias,
            faturamento_diario: resultado
        });

    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao buscar faturamento por dia.",
            erro: error.message
        });
    }
});
//feito
router.get('/estatisticas', async (req, res) => {
    try {
        const estatisticas = await FaturaModel.getEstatisticas();

        return res.status(200).json({
            sucesso: true,
            estatisticas: estatisticas
        });

    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao buscar estatísticas financeiras.",
            erro: error.message
        });
    }
});
//feito
router.get('/transacao/:transacaoId', async (req, res) => {
    try {
        const { transacaoId } = req.params;

        const fatura = await FaturaModel.buscarPorTransacaoExterna(transacaoId);

        if (!fatura) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Nenhuma fatura encontrada com esse ID de transação externa."
            });
        }

        return res.status(200).json({
            sucesso: true,
            fatura: fatura
        });

    } catch (error) {
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno ao buscar fatura por transação externa.",
            erro: error.message
        });
    }
});

module.exports = router;
const express = require("express");
const db = require("../db");
const FaturaModel = require("../models/FaturaModel");

const router = express.Router();

 router.post("/criar/pagamento", async (req, res) => {
    try {
        const dados = req.body;

        const fatura = await FaturaModel.criar(dados);

        res.status(201).json({
            sucesso: true,
            mensagem: "Fatura criada com sucesso",
            fatura: fatura
        });

    } catch (error) {
        res.status(400).json({
            sucesso: false,
            mensagem: error.message
        });
    }
});

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


module.exports = router;
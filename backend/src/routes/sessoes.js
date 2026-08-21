const express = require("express");
const db = require("../db");
const SessaoModel = require("../models/SessaoModel");

console.log("ARQUIVO SESSOES FOI CARREGADO");
const router = express.Router();

router.get("/buscar", async (req, res) => {
    try {
        const sessoes = await SessaoModel.buscarTodasAtivas();
        console.log(sessoes)
        res.json(sessoes);

    } catch (error) {
        console.error("Erro ao buscar sessões ativas:", error);

        res.status(500).json({
            erro: "Erro ao buscar sessões ativas"
        });
    }
});

router.get("/calcular/demanda", async (req, res) => {
    try {
        const demanda = await SessaoModel.getDemandaTotal();

        res.status(200).json(demanda);

    } catch (error) {
        console.error("Erro ao buscar demanda total:", error);

        res.status(500).json({
            erro: "Erro ao buscar demanda total"
        });
    }
});


router.post("/criar", async (req, res) => {
    try {
        const sessao = await SessaoModel.criar(req.body);

        res.status(201).json({
            sucesso: true,
            dados: sessao
        });

    } catch (error) {
        console.error("Erro ao criar sessão:", error);

        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }

});

router.get("/busca", async (req, res) => {
    try {
        const id = req.query.id;

        const sessao = await SessaoModel.buscarPorId(id);

        if (!sessao) {
            return res.status(404).json({
                sucesso: false,
                erro: "Sessão não encontrada"
            });
        }

        res.status(200).json({
            sucesso: true,
            dados: sessao
        });

    } catch (error) {
        console.error("Erro ao buscar a sessão por id:", error);

        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

router.get("/ativa", async (req, res) => {
    try {
        const rfidUid = req.query.id;

        const sessao = await SessaoModel.buscarAtivaPorRFID(rfidUid);

        if (!sessao) {
            return res.status(404).json({
                sucesso: false,
                erro: "Nenhuma sessão ativa encontrada para este RFID"
            });
        }

        res.status(200).json({
            sucesso: true,
            dados: sessao
        });

    } catch (error) {
        console.error("Erro ao buscar sessão ativa:", error);

        res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar sessão ativa"
        });
    }
});

router.patch("/atualizar/potencia/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const { novaPotencia } = req.body || {};

        if (novaPotencia === undefined) {
            return res.status(400).json({
                sucesso: false,
                erro: "O campo novaPotencia é obrigatório"
            });
        }

        const sessao = await SessaoModel.atualizarPotencia(
            id,
            novaPotencia
        );

        if (!sessao) {
            return res.status(404).json({
                sucesso: false,
                erro: "Sessão não encontrada"
            });
        }

        res.status(200).json({
            sucesso: true,
            mensagem: "Potência atualizada com sucesso",
            dados: sessao
        });

    } catch (error) {
        console.error("Erro ao atualizar potência:", error);

        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

router.patch("/encerrar/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const sessao = await SessaoModel.encerrar(
            id,
            req.body
        );

        if (!sessao) {
            return res.status(404).json({
                sucesso: false,
                erro: "Sessão não encontrada ou já encerrada"
            });
        }

        res.status(200).json({
            sucesso: true,
            mensagem: "Sessão encerrada com sucesso",
            dados: sessao
        });

    } catch (error) {
        console.error("Erro ao encerrar sessão:", error);

        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

router.patch("/atualizar/status/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const sessao = await SessaoModel.atualizarStatus(
            id,
            req.body
        );

        if (!sessao) {
            return res.status(404).json({
                sucesso: false,
                erro: "status nao encontrado"
            });
        }

        res.status(200).json({
            sucesso: true,
            mensagem: "Status atualizado com sucesso",
            dados: sessao
        });


    } catch (error) {
          console.error("Erro ao atualizar status:", error);

        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
})

module.exports = router;
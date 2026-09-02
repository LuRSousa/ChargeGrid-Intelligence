const express = require("express");
const router = express.Router();
const RFIDModel = require("../models/RFIDModel");

router.get("/buscar/cartao/:uid", async (req, res) => {
    try {
        const { uid } = req.params;
        const cartao = await RFIDModel.buscarPorUID(uid);

        if (!cartao) {
            return res.status(404).json({ mensagem: "Cartão RFID não cadastrado." });
        }

        return res.status(200).json(cartao);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro interno no servidor.", 
            detalhe: error.message 
        });
    }
});

router.get("/listar", async (req, res) => {
    try {
        const { status } = req.query;
        const cartoes = await RFIDModel.buscarTodos(status);

        return res.status(200).json(cartoes);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro interno no servidor ao listar cartões.", 
            detalhe: error.message 
        });
    }
});

router.get("/disponiveis", async (req, res) => {
    try {
        const cartoesDisponiveis = await RFIDModel.buscarDisponiveis();

        return res.status(200).json(cartoesDisponiveis);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao buscar cartões disponíveis.", 
            detalhe: error.message 
        });
    }
});

router.get("/uso", async (req, res) => {
    try {
        const cartoesEmUso = await RFIDModel.buscarEmUso();

        return res.status(200).json(cartoesEmUso);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao buscar cartões em uso.", 
            detalhe: error.message 
        });
    }
});

router.patch("/status/:uid", async (req, res) => {
    try {
        const { uid } = req.params;
        const { novoStatus } = req.body;


        if (!novoStatus) {
            return res.status(400).json({ mensagem: "O campo 'novoStatus' é obrigatório no corpo da requisição." });
        }

        const cartaoAtualizado = await RFIDModel.atualizarStatus(uid, novoStatus);

        if (!cartaoAtualizado) {
            return res.status(404).json({ mensagem: "Cartão não encontrado para atualizar." });
        }

        return res.status(200).json({
            mensagem: "Status do cartão atualizado com sucesso!",
            cartao: cartaoAtualizado
        });
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao atualizar o status do cartão.", 
            detalhe: error.message 
        });
    }
});

router.patch("/em-uso/:uid", async (req, res) => {
    try {
        const { uid } = req.params;

        const cartaoAtualizado = await RFIDModel.marcarComoEmUso(uid);

        if (!cartaoAtualizado) {
            return res.status(404).json({ mensagem: "Cartão não encontrado para alterar o status." });
        }

        return res.status(200).json({
            mensagem: "Cartão marcado como 'em_uso' com sucesso!",
            cartao: cartaoAtualizado
        });
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao marcar cartão como em uso.", 
            detalhe: error.message 
        });
    }
});

router.patch("/estoque/:uid", async (req, res) => {
    try {
        const { uid } = req.params;

        const cartaoAtualizado = await RFIDModel.marcarComoDisponivel(uid);

        if (!cartaoAtualizado) {
            return res.status(404).json({ mensagem: "Cartão não encontrado para alterar o status." });
        }

        return res.status(200).json({
            mensagem: "Cartão marcado como 'estoque' com sucesso!",
            cartao: cartaoAtualizado
        });
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao marcar cartão como disponível em estoque.", 
            detalhe: error.message 
        });
    }
});

router.patch("/bloquear/:uid", async (req, res) => {
    try {
        const { uid } = req.params;

        const cartaoAtualizado = await RFIDModel.bloquear(uid);

        if (!cartaoAtualizado) {
            return res.status(404).json({ mensagem: "Cartão não encontrado para ser bloqueado." });
        }

        return res.status(200).json({
            mensagem: "Cartão bloqueado com sucesso!",
            cartao: cartaoAtualizado
        });
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao bloquear o cartão.", 
            detalhe: error.message 
        });
    }
});

router.post("/cadastrar", async (req, res) => {
    try {
        const { uid, status } = req.body;

        if (!uid) {
            return res.status(400).json({ mensagem: "O campo 'uid' é obrigatório." });
        }

        const novoCartao = await RFIDModel.cadastrar(uid, status);

        return res.status(201).json({
            mensagem: "Cartão cadastrado com sucesso!",
            cartao: novoCartao
        });
    } catch (error) {

        if (error.message.includes("já está cadastrado")) {
            return res.status(400).json({ mensagem: error.message });
        }

        return res.status(500).json({ 
            erro: "Erro ao cadastrar o cartão RFID.", 
            detalhe: error.message 
        });
    }
});

router.delete("/remover/:uid", async (req, res) => {
    try {
        const { uid } = req.params;

        const resultado = await RFIDModel.remover(uid);

        return res.status(200).json(resultado);
    } catch (error) {

        if (error.message.includes("não encontrado")) {
            return res.status(404).json({ mensagem: error.message });
        }

        if (error.message.includes("não pode ser removido")) {
            return res.status(400).json({ mensagem: error.message });
        }

        return res.status(500).json({ 
            erro: "Erro ao remover o cartão RFID.", 
            detalhe: error.message 
        });
    }
});

router.get("/resumo", async (req, res) => {
    try {
        const estatisticas = await RFIDModel.getEstatisticas();

        return res.status(200).json(estatisticas);
    } catch (error) {
        return res.status(500).json({ 
            erro: "Erro ao buscar resumo dos cartões.", 
            detalhe: error.message 
        });
    }
});

module.exports = router;
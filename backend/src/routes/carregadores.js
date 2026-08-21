const express = require("express");
const CarregadorModel = require("../models/CarregadorModel");

console.log("ROTA DE CARREGADORES FOI CARREGADA");

const router = express.Router();

router.get("/buscar/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const carregador = await CarregadorModel.buscarPorId(id);

        if (!carregador) {
            return res.status(404).json({
                sucesso: false,
                erro: "Carregador não encontrado"
            });
        }

        return res.status(200).json({
            sucesso: true,
            carregador: carregador
        });

    } catch (error) {
        console.error("Erro ao buscar carregador:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar carregador"
        });
    }
});

router.get("/busca/todos/carregadores", async (req, res) => {
    try {
        const { status } = req.query;

        const carregadores = await CarregadorModel.buscarTodos(status);

        return res.status(200).json({
            sucesso: true,
            carregadores: carregadores
        });

    } catch (error) {
        console.error("Erro ao buscar carregadores:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar carregadores"
        });
    }
});

router.get("/ativos", async (req, res) => {
    try {
        const carregadores = await CarregadorModel.buscarAtivos();

        return res.status(200).json({
            sucesso: true,
            carregadores: carregadores
        });

    } catch (error) {
        console.error("Erro ao buscar carregadores ativos:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar carregadores ativos"
        });
    }
});



router.get("/potencia/maxima", async (req, res) => {
    try {
        const potenciaMaxima = await CarregadorModel.getPotenciaTotalMaxima();

        return res.status(200).json({
            sucesso: true,
            potencia_maxima_total: potenciaMaxima
        });

    } catch (error) {
        console.error("Erro ao buscar potência máxima total:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar potência máxima total"
        });
    }
});


router.get("/potencia/atual", async (req, res) => {
    try {
        const potenciaAtual = await CarregadorModel.getPotenciaTotalAtual();

        return res.status(200).json({
            sucesso: true,
            potencia_total_atual: potenciaAtual
        });

    } catch (error) {
        console.error("Erro ao buscar potência total atual:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar potência total atual"
        });
    }
});

router.patch("/status/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                sucesso: false,
                erro: "Status é obrigatório"
            });
        }

        const carregador = await CarregadorModel.atualizarStatus(id, status);

        if (!carregador) {
            return res.status(404).json({
                sucesso: false,
                erro: "Carregador não encontrado"
            });
        }

        return res.status(200).json({
            sucesso: true,
            carregador: carregador
        });

    } catch (error) {
        console.error("Erro ao atualizar status:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao atualizar status do carregador"
        });
    }
});

router.patch("/atualiza/potencia/atual/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { potenciaAtual } = req.body;

        if (potenciaAtual === undefined) {
            return res.status(400).json({
                sucesso: false,
                erro: "Potência atual é obrigatória"
            });
        }

        const carregador = await CarregadorModel.atualizarPotencia(
            id,
            potenciaAtual
        );

        if (!carregador) {
            return res.status(404).json({
                sucesso: false,
                erro: "Carregador não encontrado"
            });
        }

        return res.status(200).json({
            sucesso: true,
            carregador: carregador
        });

    } catch (error) {
        console.error("Erro ao atualizar potência:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao atualizar potência do carregador"
        });
    }
});

router.patch("/atualiza/spj/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, potenciaAtual } = req.body;

        if (!status) {
            return res.status(400).json({
                sucesso: false,
                erro: "Status é obrigatório"
            });
        }

        const carregador = await CarregadorModel.atualizarStatusEPotencia(
            id,
            status,
            potenciaAtual
        );

        if (!carregador) {
            return res.status(404).json({
                sucesso: false,
                erro: "Carregador não encontrado"
            });
        }

        return res.status(200).json({
            sucesso: true,
            carregador: carregador
        });

    } catch (error) {
        console.error("Erro ao atualizar status e potência:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao atualizar status e potência do carregador"
        });
    }
});

router.post("/criar", async (req, res) => {
    try {
        const carregador = await CarregadorModel.criar(req.body);

        return res.status(201).json({
            sucesso: true,
            carregador: carregador
        });

    } catch (error) {
        console.error("Erro ao criar carregador:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao criar carregador"
        });
    }
});

router.get("/problemas", async (req, res) => {
    try {
        const carregadores = await CarregadorModel.buscarEmErro();

        return res.status(200).json({
            sucesso: true,
            carregadores: carregadores
        });

    } catch (error) {
        console.error("Erro ao buscar carregadores em erro:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao buscar carregadores em erro"
        });
    }
});

router.patch("/resetar", async (req, res) => {
    try {
        await CarregadorModel.resetarTodos();

        return res.status(200).json({
            sucesso: true,
            mensagem: "Todos os carregadores foram resetados"
        });

    } catch (error) {
        console.error("Erro ao resetar carregadores:", error);

        return res.status(500).json({
            sucesso: false,
            erro: "Erro ao resetar carregadores"
        });
    }
});

module.exports = router;
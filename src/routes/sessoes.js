const express = require("express");
const SessaoModel = require("../models/SessaoModel");
const CarregadorModel = require("../models/CarregadorModel");
const RFIDModel = require("../models/RFIDModel");
const FaturaModel = require("../models/FaturaModel");
const {
    rebalancearPotencias,
    calcularLimiteContratado,
    calcularPotenciaMedia,
    calcularDuracaoMinutos,
    calcularDuracaoHoras,
    calcularEnergia,
    calcularTarifa,
    verificarLimiteAtingido
} = require("../logic");

console.log("ARQUIVO SESSOES FOI CARREGADO");

const router = express.Router();

router.get("/buscar", async (req, res) => {
    try {
        const sessoes = await SessaoModel.buscarTodasAtivas();
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
        const demanda_total = await CarregadorModel.getPotenciaTotalAtual();
        const sessoesAtivas = await SessaoModel.buscarTodasAtivas();

        res.status(200).json({
            demanda_total,
            qnt_sessoes: sessoesAtivas.length
        });
    } catch (error) {
        console.error("Erro ao buscar demanda total:", error);
        res.status(500).json({ erro: "Erro ao buscar demanda total" });
    }
});

router.post("/criar", async (req, res) => {
    try {
        const { cartao_rfid_uid, carregador_id } = req.body;

        const carregador = await CarregadorModel.buscarPorId(carregador_id);
        if (!carregador || carregador.status_modbus !== 'ocioso') {
            return res.status(409).json({ sucesso: false, erro: "Carregador não está disponível" });
        }

        const cartao = await RFIDModel.buscarPorUID(cartao_rfid_uid);
        if (!cartao || cartao.status_cartao_rfid !== 'estoque') {
            return res.status(409).json({ sucesso: false, erro: "Cartão RFID não está disponível" });
        }

        const sessao = await SessaoModel.criar(req.body);
        await RFIDModel.marcarComoEmUso(cartao_rfid_uid);
        await CarregadorModel.atualizarStatus(carregador_id, 'aguardando_inicio_sessao');

        res.status(201).json({ sucesso: true, dados: sessao });
    } catch (error) {
        console.error("Erro ao criar sessão:", error);
        res.status(500).json({ sucesso: false, erro: error.message });
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

//Função reutilizável para aplicar o rebalanceamento de potências
async function aplicarRebalanceamento() {
    const sessoesAtivas = await SessaoModel.buscarTodasAtivas();
    const demandaAtual = await CarregadorModel.getPotenciaTotalAtual();
    const potenciaTotalMaxima = await CarregadorModel.getPotenciaTotalMaxima();
    const limiteContratado = calcularLimiteContratado(potenciaTotalMaxima);

    const resultado = rebalancearPotencias(sessoesAtivas, demandaAtual, limiteContratado);

    for (const ajuste of resultado.ajustes) {
        await SessaoModel.atualizarPotencia(ajuste.sessao_id, ajuste.potencia_nova);
        await CarregadorModel.atualizarPotencia(ajuste.carregador_id, ajuste.potencia_nova);
    }

    return resultado;
}

router.patch("/iniciar-carregamento/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { limite_valor, modo_carga } = req.body || {};

        const sessao = await SessaoModel.iniciarCarregamento(id, { limite_valor, modo_carga });

        if (!sessao) {
            return res.status(409).json({
                sucesso: false,
                erro: "Sessão não encontrada ou não está no estado 'iniciada'"
            });
        }

        if (sessao.carregador_id) {
            await CarregadorModel.atualizarStatus(sessao.carregador_id, 'em_uso');
        }

        const rebalanceamento = await aplicarRebalanceamento();

        res.status(200).json({
            sucesso: true,
            mensagem: "Carregamento iniciado",
            dados: sessao,
            rebalanceamento
        });

    } catch (error) {
        console.error("Erro ao iniciar carregamento:", error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

router.patch("/encerrar/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { rfid_uid, carregador_id } = req.body;

        const sessaoAtual = await SessaoModel.buscarPorId(id);
        if (!sessaoAtual || !['iniciada', 'carregando'].includes(sessaoAtual.sessao_status)) {
            return res.status(404).json({
                sucesso: false,
                erro: "Sessão não encontrada ou já encerrada"
            });
        }

        const duracaoMinutos = calcularDuracaoMinutos(new Date(sessaoAtual.inicio_recarga));
        const tempoHoras = calcularDuracaoHoras(new Date(sessaoAtual.inicio_recarga));
        const energiaKwh = calcularEnergia(sessaoAtual.potencia_media, tempoHoras);

        const demandaTotal = await CarregadorModel.getPotenciaTotalAtual();
        const qntSessoes = (await SessaoModel.buscarTodasAtivas()).length;
        const tarifa = calcularTarifa(sessaoAtual.modo_carga, new Date().getHours(), demandaTotal, qntSessoes, 0, 30, 0);
        const custoTotal = Math.round(energiaKwh * tarifa * 100) / 100;

        const sessao = await SessaoModel.encerrar(id, {
            duracao_minutos: duracaoMinutos,
            energia_kwh: energiaKwh,
            tarifa_aplicada: tarifa,
            custo_total: custoTotal
        });

        if (!sessao) {
            return res.status(404).json({ sucesso: false, erro: "Sessão não encontrada ou já encerrada" });
        }

        if (rfid_uid) await RFIDModel.marcarComoDisponivel(rfid_uid);
        if (carregador_id) await CarregadorModel.atualizarStatusEPotencia(carregador_id, 'ocioso', 0);

        const rebalanceamento = await aplicarRebalanceamento();

        let fatura = null;
        try {
            fatura = await FaturaModel.criar({
                sessao_id: sessao.id,
                usuario_id: sessao.usuario_id,
                valor_total: sessao.custo_total,
                desconto_aplicado: 0
            });
        } catch (e) {
            console.error("Sessão encerrada, mas falha ao gerar fatura:", e.message);
        }


        res.status(200).json({
            sucesso: true,
            mensagem: "Sessão encerrada com sucesso",
            dados: sessao,
            rebalanceamento,
            fatura
        });

    } catch (error) {
        console.error("Erro ao encerrar sessão:", error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

router.get("/status/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const sessao = await SessaoModel.buscarPorId(id);

        if (!sessao) {
            return res.status(404).json({
                sucesso: false,
                erro: "Sessão não encontrada"
            });
        }

        if (sessao.sessao_status !== 'carregando') {
            return res.status(200).json({
                sucesso: true,
                dados: sessao,
                potencia_instantanea: 0,
                energia_atual: 0,
                custo_atual: 0,
                aviso_limite: { atingido: false, tipo: null }
            });
        }

        const carregador = await CarregadorModel.buscarPorId(sessao.carregador_id);
        const potenciaInstantanea = carregador ? carregador.potencia_atual : 0;

        const tempoDecorridoHoras = calcularDuracaoHoras(new Date(sessao.inicio_recarga));
        const potenciaMedia = calcularPotenciaMedia(
            sessao.potencia_media,
            sessao.inicio_recarga,
            sessao.atualizada_em,
            potenciaInstantanea
        );
        const energiaAtual = calcularEnergia(potenciaMedia, tempoDecorridoHoras);

        const demandaTotal = await CarregadorModel.getPotenciaTotalAtual();
        const qntSessoes = (await SessaoModel.buscarTodasAtivas()).length;

        const tarifa = calcularTarifa(sessao.modo_carga, new Date().getHours(), demandaTotal, qntSessoes, 0, 30, 0);

        const custoAtual = Math.round(energiaAtual * tarifa * 100) / 100;
        const limite = verificarLimiteAtingido(custoAtual, sessao.limite_valor);

        res.status(200).json({
            sucesso: true,
            dados: sessao,
            potencia_instantanea: potenciaInstantanea,
            energia_atual: Math.round(energiaAtual * 1000) / 1000,
            tarifa: tarifa,
            custo_atual: custoAtual,
            aviso_limite: limite
        });

    } catch (error) {
        console.error("Erro ao consultar status da sessão:", error);
        res.status(500).json({ sucesso: false, erro: error.message });
    }
});

module.exports = router;
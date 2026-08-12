// Projeto: Sistema Inteligente de Gerenciamento de Recarga - GoodWe
// Descrição: Sistema para gerenciamento de recarga de veículos elétricos

// Configurações do sistema
const MAX_SESSOES = 5;
const POT_TOTAL_MAX = 60.0; // kW
const POT_MAX_POR_SESSAO = 24.0; // kW (40% do total)

// Estrutura de dados
class Sessao {
    constructor() {
        this.id = null;
        this.nome_usuario = "";
        this.tipo_carregador = 1; // 1 - Comum, 2 - Rápido
        this.potencia_kW = 0.0;
        this.inicio_sessao = 0; // Formato HHMM
        this.fim_sessao = 0; // Formato HHMM
        this.tempo_sessao = 0.0;
        this.energia_kWh = 0.0;
        this.tarifa = 0.0;
        this.custo_total = 0.0;
        this.ativa = false;
    }
}

// Estado global
let sessoes = Array(MAX_SESSOES).fill().map(() => new Sessao());
let nextId = 1;

// Função para calcular potência total das sessões ativas
function calcularPotenciaTotal() {
    let potencia_total = 0.0;
    for (let i = 0; i < MAX_SESSOES; i++) {
        if (sessoes[i].ativa) {
            potencia_total += sessoes[i].potencia_kW;
        }
    }
    return potencia_total;
}

// Função para calcular a duração da sessão
function calcularTempoSessao(inicio, fim) {
    const inicio_min = Math.floor(inicio / 100) * 60 + (inicio % 100);
    const fim_min = Math.floor(fim / 100) * 60 + (fim % 100);

    if (fim_min < inicio_min) {
        return ((24 * 60 - inicio_min) + fim_min) / 60.0;
    } else if (fim_min === inicio_min) {
        return 24; // Duração de 24 horas
    } else {
        return (fim_min - inicio_min) / 60.0;
    }
}

// Função para calcular energia consumida
function calcularEnergia(potencia_kW, tempo_sessao) {
    return potencia_kW * tempo_sessao;
}

// Função para calcular tarifa
function calcularTarifa(tipo_carregador, inicio_sessao) {
    let tarifa;
    const potencia_total = calcularPotenciaTotal();

    switch(tipo_carregador) {
        case 1: tarifa = 0.5; break; // Comum
        case 2: tarifa = 0.8; break; // Rápido
        default: tarifa = 0.5; break;
    }

    let qnt_sessoes_ativas = sessoes.filter(s => s.ativa).length;

    // Aumenta tarifa em 15% se potência > 75% ou 3+ sessões ativas
    if (potencia_total >= 0.75 * POT_TOTAL_MAX || qnt_sessoes_ativas >= 3) {
        tarifa *= 1.15;
    }

    const hora_inicio = Math.floor(inicio_sessao / 100);
    // Aumenta tarifa em 20% no horário de pico (18h-21h)
    if (hora_inicio >= 18 && hora_inicio < 21) {
        tarifa *= 1.2;
    }

    // IA aplica desconto solar de 15% quando solar > 60%
    const solar = calcularSolar();
    if (solar > 60) {
        tarifa *= 0.85; 
    }

    return tarifa;
}

// Função para calcular custo total
function calcularCusto(energia_kWh, tarifa) {
    return energia_kWh * tarifa;
}

// Função para rebalancear potências (principal lógica do sistema)
function rebalancearPotencias() {
    const qnt_sessoes_ativas = sessoes.filter(s => s.ativa).length;

    if (qnt_sessoes_ativas === 0) {
        return { mensagem: "Nenhuma sessão ativa", potencia_por_sessao: 0 };
    }

    let potencia_por_sessao = POT_TOTAL_MAX / qnt_sessoes_ativas;
    let limite_aplicado = false;

    if (potencia_por_sessao > POT_MAX_POR_SESSAO) {
        potencia_por_sessao = POT_MAX_POR_SESSAO;
        limite_aplicado = true;
    }

    const ajustes = [];

    for (let i = 0; i < MAX_SESSOES; i++) {
        if (sessoes[i].ativa) {
            const potencia_antiga = sessoes[i].potencia_kW;
            const diferenca = Math.abs(potencia_antiga - potencia_por_sessao);

            if (diferenca > 0.01) {
                sessoes[i].potencia_kW = potencia_por_sessao;

                // Recalcula energia e custo
                sessoes[i].energia_kWh = calcularEnergia(
                    sessoes[i].potencia_kW,
                    sessoes[i].tempo_sessao
                );
                sessoes[i].custo_total = calcularCusto(
                    sessoes[i].energia_kWh,
                    sessoes[i].tarifa
                );

                ajustes.push({
                    sessao_id: i + 1,
                    nome: sessoes[i].nome_usuario,
                    potencia_antiga: potencia_antiga,
                    potencia_nova: potencia_por_sessao
                });
            }
        }
    }

    const potencia_total = calcularPotenciaTotal();

    return {
        mensagem: limite_aplicado ? 
            `Limite máximo de ${POT_MAX_POR_SESSAO} kW por carregador aplicado` : 
            `Potência distribuída igualmente`,
        potencia_por_sessao: potencia_por_sessao,
        limite_aplicado: limite_aplicado,
        ajustes: ajustes,
        potencia_total: potencia_total,
        percentual_uso: (potencia_total / POT_TOTAL_MAX) * 100
    };
}

// Função para simular mensagens OCPP
function simularOcpp(tipo_mensagem, id_sessao, horario) {
    const hora = Math.floor(horario / 100);
    const minuto = horario % 100;
    return {
        tipo: tipo_mensagem,
        id_sessao: id_sessao,
        horario: `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`,
        timestamp: new Date().toISOString()
    };
}

// Função para iniciar nova sessão
function iniciarSessao(dados) {
    // Validações
    if (!dados.nome_usuario || dados.nome_usuario.trim() === "") {
        return { sucesso: false, erro: "Nome do usuário é obrigatório" };
    }

    if (dados.tipo_carregador < 1 || dados.tipo_carregador > 2) {
        return { sucesso: false, erro: "Tipo de carregador inválido" };
    }

    if (!validarHorario(dados.inicio_sessao)) {
        return { sucesso: false, erro: "Horário de início inválido" };
    }

    if (!validarHorario(dados.fim_sessao)) {
        return { sucesso: false, erro: "Horário de término inválido" };
    }

    // Verificar se há slot disponível
    const slotIndex = sessoes.findIndex(s => !s.ativa);
    if (slotIndex === -1) {
        return { sucesso: false, erro: "Limite de sessões ativas atingido" };
    }

    // Criar nova sessão
    const novaSessao = new Sessao();
    novaSessao.id = nextId++;
    novaSessao.nome_usuario = dados.nome_usuario;
    novaSessao.tipo_carregador = parseInt(dados.tipo_carregador);
    novaSessao.inicio_sessao = parseInt(dados.inicio_sessao);
    novaSessao.fim_sessao = parseInt(dados.fim_sessao);
    novaSessao.tempo_sessao = calcularTempoSessao(novaSessao.inicio_sessao, novaSessao.fim_sessao);
    novaSessao.tarifa = calcularTarifa(novaSessao.tipo_carregador, novaSessao.inicio_sessao);

    // Inserir no slot
    sessoes[slotIndex] = novaSessao;
    sessoes[slotIndex].ativa = true;

    // Rebalancear potências
    sessoes[slotIndex].energia_kWh = calcularEnergia(novaSessao.potencia_kW, novaSessao.tempo_sessao);
    sessoes[slotIndex].custo_total  = calcularCusto(sessoes[slotIndex].energia_kWh, novaSessao.tarifa);
    const rebalanceamento = rebalancearPotencias();

    // Simular mensagens OCPP
    const ocppMessages = [
        simularOcpp("StatusNotification: Occupied", slotIndex + 1, 0),
        simularOcpp("StartTransaction", slotIndex + 1, novaSessao.inicio_sessao)
    ];

    return {
        sucesso: true,
        sessao: {
            id: slotIndex + 1,
            slot: slotIndex + 1,
            ...novaSessao,
            potencia_kW: sessoes[slotIndex].potencia_kW,
            energia_kWh: sessoes[slotIndex].energia_kWh,
            custo_total: sessoes[slotIndex].custo_total
        },
        rebalanceamento: rebalanceamento,
        ocpp_messages: ocppMessages
    };
}

// Função para encerrar sessão
function encerrarSessao(slotId) {
    const idx = slotId - 1;

    if (idx < 0 || idx >= MAX_SESSOES || sessoes[idx].ativa === false) {
        return { sucesso: false, erro: "Sessão não encontrada ou já inativa" };
    }

    const sessaoEncerrada = { ...sessoes[idx] };
    
    // Encerrar sessão
    sessoes[idx].ativa = false;
    sessoes[idx] = new Sessao();

    // Rebalancear potências restantes
    const rebalanceamento = rebalancearPotencias();

    // Simular mensagens OCPP
    const ocppMessages = [
        simularOcpp("StatusNotification: Available", slotId, sessaoEncerrada.fim_sessao),
        simularOcpp("StopTransaction", slotId, sessaoEncerrada.fim_sessao),
        simularOcpp("MeterValues", slotId, sessaoEncerrada.fim_sessao)
    ];

    return {
        sucesso: true,
        sessao: {
            id: slotId,
            ...sessaoEncerrada
        },
        rebalanceamento: rebalanceamento,
        ocpp_messages: ocppMessages
    };
}

// Função para listar sessões ativas
function listarSessoesAtivas() {
    const ativas = [];
    for (let i = 0; i < MAX_SESSOES; i++) {
        if (sessoes[i].ativa) {
            ativas.push({
                slot: i + 1,
                id: sessoes[i].id,
                nome_usuario: sessoes[i].nome_usuario,
                tipo_carregador: sessoes[i].tipo_carregador === 1 ? "Comum" : "Rápido",
                potencia_kW: sessoes[i].potencia_kW,
                inicio_sessao: formatarHorario(sessoes[i].inicio_sessao),
                fim_sessao: formatarHorario(sessoes[i].fim_sessao),
                energia_kWh: sessoes[i].energia_kWh,
                custo_total: sessoes[i].custo_total
            });
        }
    }

    const potencia_total = calcularPotenciaTotal();

    return {
        sessoes_ativas: ativas,
        total_sessoes: ativas.length,
        potencia_total: potencia_total,
        percentual_uso: (potencia_total / POT_TOTAL_MAX) * 100,
        limite_maximo: POT_TOTAL_MAX,
        limite_por_sessao: POT_MAX_POR_SESSAO
    };
}

// Função para obter relatório de uma sessão específica
function obterRelatorioSessao(slotId) {
    const idx = slotId - 1;

    if (idx < 0 || idx >= MAX_SESSOES || !sessoes[idx].ativa) {
        return { sucesso: false, erro: "Sessão não encontrada ou inativa" };
    }

    const sessao = sessoes[idx];
    const horas = Math.floor(sessao.tempo_sessao);
    const minutos = Math.floor((sessao.tempo_sessao - horas) * 60);

    return {
        sucesso: true,
        relatorio: {
            usuario: sessao.nome_usuario,
            id_carregador: slotId,
            tipo_carregador: sessao.tipo_carregador === 1 ? "Comum" : "Rápido",
            potencia: sessao.potencia_kW,
            inicio: formatarHorario(sessao.inicio_sessao),
            termino: formatarHorario(sessao.fim_sessao),
            duracao: `${horas} horas e ${minutos} minutos`,
            energia: sessao.energia_kWh,
            tarifa: sessao.tarifa,
            total: sessao.custo_total
        }
    };
}

// Funções auxiliares
function validarHorario(horario) {
    const hora = Math.floor(horario / 100);
    const minuto = horario % 100;
    return hora >= 0 && hora <= 23 && minuto >= 0 && minuto <= 59;
}

function formatarHorario(horario) {
    const hora = Math.floor(horario / 100).toString().padStart(2, '0');
    const minuto = (horario % 100).toString().padStart(2, '0');
    return `${hora}:${minuto}`;
}
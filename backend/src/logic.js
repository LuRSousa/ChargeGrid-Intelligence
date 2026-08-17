//Calcula a energia consumida em kWh
//Retorna {number} Energia em kWh
function calcularEnergia(potencia_kW, tempo_sessao) {
    return potencia_kW * tempo_sessao;
}

//Calcula a tarifa dinâmica com base no modo de carregamento e condições atuais
//Retorna {number} Tarifa em R$/kWh
function calcularTarifa(modo, horaInicio, demandaTotal, qntSessoes, solarPercentual = 0, limiteAltaDemanda = 30, descontoPercentual = 0) {
    //Tarifa base pela forma de carregamento
    const tarifas = {
        'FV': 0.30,
        'FV_baterias': 0.50,
        'rapido': 0.80
    }

    let tarifa = tarifas[modo] || 0.80;

    //Aumenta tarifa em 15% se demanda total > 75% ou 3+ sessões ativas
    if (demandaTotal > limiteAltaDemanda || qntSessoes >= 3) {
        tarifa *= 1.15;
    }

    //Aumenta tarifa em 20% no horário de pico (18h-21h)
    if (horaInicio >= 18 && horaInicio < 21) {
        tarifa *= 1.2;
    }

    //Desconto solar de 15% quando solar > 60%
    if (modo !== 'rápido' && solarPercentual > 60) {
        tarifa *= 0.85; 
    }

    //Desconto do plano do usuário
    if (descontoPercentual > 0) {
        tarifa *= (1 - descontoPercentual / 100);
    }

    return Math.round(tarifa * 100) / 100;
}

//Gera sugestões de rebalanceamento de potência (DLB)
//Retorna {Object} Sugestões de ajuste
function rebalancearPotencias(sessoesAtivas, demandaTotal, limiteContratado, potenciaMaxPorSessao = null) {
    const qnt = sessoesAtivas.length;

    //Se não há sessões ativas ou não há limite definido
    if (qnt === 0 || !limiteContratado || limiteContratado <= 0) {
        return {
            ajustes: [],
            mensagem: qnt === 0 ? 'Nenhuma sessão ativa' : 'Limite não definido',
            demanda_atual: demandaTotal || 0,
            demanda_apos_ajuste: 0,
            percentual_uso: 0,
            limite_contratado: limiteContratado || 0,
            potencia_ideal_por_sessao: 0
        };
    }

    //Calcula a potência ideal por sessão (distribuição igualitária)
    let potenciaIdeal = limiteContratado / qnt;

    //Se houver um limite máximo por sessão, aplica
    if (potenciaMaxPorSessao && potenciaIdeal > potenciaMaxPorSessao) {
        potenciaIdeal = potenciaMaxPorSessao;
    }

    //Identifica quais sessões precisam de ajuste
    const ajustes = [];
    let demandaAposAjuste = 0;

    for (const sessao of sessoesAtivas) {
        const potenciaAntiga = sessao.potencia_atual || 0;
        
        //Respeita o limite individual do carregador
        const potenciaMaxCarregador = sessao.potencia_maxima_carregador || 22;
        const potenciaNova = Math.min(potenciaIdeal, potenciaMaxCarregador);

        //Se a diferença for maior que 0.1 kW, registra o ajuste
        if (Math.abs(potenciaAntiga - potenciaNova) > 0.1) {
            ajustes.push({
                sessao_id: sessao.id,
                carregador_id: sessao.carregador_id,
                potencia_antiga: Math.round(potenciaAntiga * 100) / 100,
                potencia_nova: Math.round(potenciaNova * 100) / 100,
                motivo: potenciaNova < potenciaAntiga 
                    ? 'Redução por demanda' 
                    : 'Aumento por disponibilidade'
            });
        }
        demandaAposAjuste += potenciaNova;
    }

    const percentualUso = limiteContratado > 0 
        ? Math.round((demandaTotal / limiteContratado) * 100) 
        : 0;

    return {
        ajustes,
        mensagem: ajustes.length > 0 
            ? `${ajustes.length} ajuste(s) sugerido(s)`
            : 'Nenhum ajuste necessário',
        demanda_atual: Math.round(demandaTotal * 100) / 100,
        demanda_apos_ajuste: Math.round(demandaAposAjuste * 100) / 100,
        percentual_uso: percentualUso,
        limite_contratado: limiteContratado,
        potencia_ideal_por_sessao: Math.round(potenciaIdeal * 100) / 100
    };
}

//Calcula a duração da sessão em minutos
//Retorna {number} Duração em minutos
function calcularDuracaoMinutos(inicio, fim = new Date()) {
    const diffMs = fim.getTime() - inicio.getTime();
    return Math.max(0, Math.round(diffMs / 60000));
}

//Calcula a duração da sessão em horas (decimal)
//Retorna {number} Duração em horas
function calcularDuracaoHoras(inicio, fim = new Date()) {
    return calcularDuracaoMinutos(inicio, fim) / 60;
}

//Verifica se uma sessão está em horário de pico
//Retorna {boolean}
function isHorarioPico(data = new Date()) {
    const hora = data.getHours();
    return hora >= 18 && hora < 21;
}

//Retorna a porcentagem de geração solar simulada com base no horário
//Retorna {number} Percentual de geração solar (0-100)
function calcularSolar(data = new Date()) {
    const h = data.getHours();
    // Entre 6h e 20h, simula curva de geração
    if (h < 6 || h >= 20) return 0;
    // Pico máximo ao meio-dia (13h)
    const pico = 13;
    const maximo = 100;
    const fator = 1 - Math.abs(h - pico) / 7;
    return Math.max(0, Math.round(fator * maximo));
}

//Exportação de módulos
module.exports = {
    calcularEnergia,
    calcularTarifa,
    rebalancearPotencias,
    calcularDuracaoMinutos,
    calcularDuracaoHoras,
    isHorarioPico,
    calcularSolar
};
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
    if (modo !== 'rapido' && solarPercentual > 60) {
        tarifa *= 0.85; 
    }

    //Desconto do plano do usuário
    if (descontoPercentual > 0) {
        tarifa *= (1 - descontoPercentual / 100);
    }

    return Math.round(tarifa * 100) / 100;
}

//Distribui a potência disponível entre as sessões ativas de forma justa,
//redistribuindo automaticamente a sobra de carregadores com limite menor
//para os que ainda podem receber mais
//Retorna {Object} Sugestões de ajuste
function rebalancearPotencias(sessoesAtivas, demandaTotal, limiteContratado) {
    const qnt = sessoesAtivas.length;

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

    // Cada sessão começa "pendente" — ainda não teve sua potência final decidida
    const pendentes = sessoesAtivas.map(s => ({
        id: s.id,
        carregador_id: s.carregador_id,
        potencia_antiga: s.potencia_media || 0,
        potencia_maxima: s.potencia_maxima || 22,
        atendida: false,
        potencia_final: 0
    }));

    let orcamentoRestante = limiteContratado;
    let houveMudanca = true;

    while (houveMudanca) {
        houveMudanca = false;
        const ativas = pendentes.filter(s => !s.atendida);
        if (ativas.length === 0) break;

        const fatiaIgual = orcamentoRestante / ativas.length;

        for (const s of ativas) {
            if (s.potencia_maxima <= fatiaIgual) {
                s.potencia_final = s.potencia_maxima;
                s.atendida = true;
                orcamentoRestante -= s.potencia_maxima;
                houveMudanca = true;
            }
        }
    }

    const restantes = pendentes.filter(s => !s.atendida);
    if (restantes.length > 0) {
        const fatiaFinal = orcamentoRestante / restantes.length;
        for (const s of restantes) {
            s.potencia_final = Math.max(0, fatiaFinal);
        }
    }

    const ajustes = [];
    let demandaAposAjuste = 0;

    for (const s of pendentes) {
        const potenciaNova = Math.round(s.potencia_final * 100) / 100;
        demandaAposAjuste += potenciaNova;

        if (Math.abs(s.potencia_antiga - potenciaNova) > 0.1) {
            ajustes.push({
                sessao_id: s.id,
                carregador_id: s.carregador_id,
                potencia_antiga: Math.round(s.potencia_antiga * 100) / 100,
                potencia_nova: potenciaNova,
                motivo: potenciaNova < s.potencia_antiga
                    ? 'Redução por demanda'
                    : 'Aumento por disponibilidade'
            });
        }
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
        potencia_ideal_por_sessao: Math.round((limiteContratado / qnt) * 100) / 100
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

//Calcula a potência média considerando leituras anteriores e o tempo decorrido
//Retorna {number} Potência média em kW
function calcularPotenciaMedia(mediaAtual, inicioRecarga, ultimaAtualizacao, potenciaNova, agora = new Date()) {
    const media = mediaAtual !== null ? Number(mediaAtual) : null;
    const nova = Number(potenciaNova);

    const inicio = new Date(inicioRecarga);
    const ultimaLeitura = new Date(ultimaAtualizacao || inicioRecarga);

    const tempoAnterior = (ultimaLeitura - inicio) / 1000;
    const tempoNovo = (agora - ultimaLeitura) / 1000;

    if (media === null || tempoAnterior <= 0) {
        return nova; // agora garantidamente um number
    }

    const tempoTotal = tempoAnterior + tempoNovo;
    return ((media * tempoAnterior) + (nova * tempoNovo)) / tempoTotal;
}

//Verifica se a sessão atingiu o limite definido pelo usuário
//Retorna {Object} { atingido: boolean, tipo: string|null }
function verificarLimiteAtingido(custoAtual, limiteValor) {
    if (limiteValor && custoAtual >= limiteValor) {
        return { atingido: true, tipo: 'valor' };
    }

    return { atingido: false, tipo: null };
}

//Calcula o limite de demanda seguro do posto, com margem de segurança sobre a capacidade total instalada (evita operar no limite físico exato)
//Retorna {number} Limite contratado em kW
function calcularLimiteContratado(potenciaTotalMaxima, margemSeguranca = 0.8) {
    return Math.round(potenciaTotalMaxima * margemSeguranca * 100) / 100;
}

//Exportação de módulos
module.exports = {
    calcularEnergia,
    calcularTarifa,
    rebalancearPotencias,
    calcularDuracaoMinutos,
    calcularDuracaoHoras,
    isHorarioPico,
    calcularSolar,
    calcularPotenciaMedia,
    verificarLimiteAtingido,
    calcularLimiteContratado
};
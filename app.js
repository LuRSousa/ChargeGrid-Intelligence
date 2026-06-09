function calcularSolar() {
    const h = new Date().getHours();
    if (h < 6 || h >= 20) return 0;
    return Math.max(0, Math.round((1 - Math.abs(h - 13) / 7) * 100));
}

function decisaoIA(solar, potencia) {
    const hora = new Date().getHours();

    if (solar > 60) {
        return { aprovado: true, msg: `IA: Priorizando solar (${solar}% disponível) — desconto aplicado` };
    }
    return { aprovado: true, msg: `IA: Carregamento aprovado` };
}

function atualizarMetricas() {
    const dados = listarSessoesAtivas();

    document.getElementById('val-solar').innerHTML = `
        <span class="metric-label">Energia Solar:</span>
        <span class="metric-value">${calcularSolar()}%</span>
    `;

    document.getElementById('val-potencia').innerHTML = `
        <span class="metric-label">Potência em uso:</span>
        <span class="metric-value">${dados.potencia_total.toFixed(1)} kW</span>
    `;

    document.getElementById('val-sessoes').innerHTML = `
        <span class="metric-label">Sessões ativas:</span>
        <span class="metric-value">${dados.total_sessoes} / 5</span>
    `;

    document.getElementById('val-percentual').innerHTML = `
        <span class="metric-label">Capacidade usada:</span>
        <span class="metric-value">${dados.percentual_uso.toFixed(0)}%</span>
    `;
}

function renderizarSlots() {
    for (let i = 1; i <= MAX_SESSOES; i++) {
        const card = document.getElementById('slot-' + i);
        const sessao = sessoes[i - 1];

        if (sessao.ativa) {
            card.className = 'charger-card ativo';
            card.innerHTML = `
                <span class="charger-id">Slot ${i}</span>
                <span class="charger-nome">Usuário: <p class="resultado">${sessao.nome_usuario}</p></span> 
                <span class="charger-tipo">Carregador: <p class="resultado">${sessao.tipo_carregador === 2 ? 'Rápido' : 'Comum'}</p></span>
                <span class="charger-kw">Potência: <p class="resultado">${sessao.potencia_kW.toFixed(1)} kW</p></span>
                <div class="fim-slot">
                    <span class="charger-status">Carregando</span>
                    <button class="btn-encerrar" onclick="encerrar(${i})">Encerrar</button>
                </div>
            `;
        } else {
            card.className = 'charger-card inativo';
            card.innerHTML = `
                <span class="charger-id">Slot ${i}</span>
                <div class="fim-slot">
                    <span class="charger-status">Livre</span>
                    <button class="btn-iniciar" onclick="abrirModal(${i})">+ Iniciar</button>
                </div>
            `;
        }
    }
}

function encerrar(slotId) {
    const resultado = encerrarSessao(slotId);
    if (!resultado.sucesso) return;

    adicionarLog(resultado.ocpp_messages);
    mostrarRelatorio(resultado.sessao);
    atualizarTodos();
}

function mostrarRelatorio(sessao) {
    const horas = Math.floor(sessao.tempo_sessao);
    const minutos = Math.floor((sessao.tempo_sessao - horas) * 60);

    document.getElementById('modal-relatorio-conteudo').innerHTML = `
        <h2>Relatório - Slot ${sessao.id}</h2>
        <p><strong>Usuário:</strong> ${sessao.nome_usuario}</p>
        <p><strong>Tipo:</strong> ${sessao.tipo_carregador === 2 ? 'Rápido' : 'Comum'}</p>
        <p><strong>Potência:</strong> ${sessao.potencia_kW.toFixed(1)} kW</p>
        <p><strong>Duração:</strong> ${horas}h ${minutos}min</p>
        <p><strong>Energia:</strong> ${sessao.energia_kWh.toFixed(2)} kWh</p>
        <p><strong>Tarifa:</strong> R$ ${sessao.tarifa.toFixed(2)}/kWh</p>
        <p><strong>Total:</strong> R$ ${sessao.custo_total.toFixed(2)}</p>
        <button type="button" onclick="fecharRelatorio()">Fechar</button>
    `;
    document.getElementById('modal-relatorio').classList.add('aberto');
}

function fecharRelatorio() {
    document.getElementById('modal-relatorio').classList.remove('aberto');
}

function adicionarLog(mensagens) {
    const log = document.getElementById('ocpp-log');
    const agora = new Date();
    const ts = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');

    mensagens.forEach(msg => {
        const linha = document.createElement('div');
        linha.className = 'ocpp-entry ' + classificarOcpp(msg.tipo);
        linha.innerHTML = `
            <span class="ocpp-ts">${ts}</span>
            <span class="ocpp-msg">[OCPP] ${msg.tipo} | ID: ${msg.id_sessao}</span>
        `;
        log.appendChild(linha);
        log.scrollTop = log.scrollHeight;
    });
}

function classificarOcpp(tipo) {
    if (tipo.includes('Stop') ) return 'error';
    if (tipo.includes('Start')) return 'warn';
    return 'info';
}

let slotAtivo = null;

function abrirModal(slotId) {
    slotAtivo = slotId;
    document.getElementById('input-nome').value = '';
    document.getElementById('input-inicio').value = '';
    document.getElementById('input-fim').value = '';
    document.getElementById('modal-erro').textContent = '';
    document.getElementById('modal-nova-sessao').classList.add('aberto');
}

function fecharModal() {
    document.getElementById('modal-nova-sessao').classList.remove('aberto');
}

function atualizarTodos() {
    atualizarMetricas();
    renderizarSlots();
}

function confirmarSessao() {
    const erro = document.getElementById('modal-erro');
    erro.textContent = '';

    const nomeVal = document.getElementById('input-nome').value.trim();
    const inicioVal = document.getElementById('input-inicio').value.trim();
    const fimVal = document.getElementById('input-fim').value.trim();

    if (!nomeVal) { erro.textContent = 'Nome é obrigatório.'; return; }
    const inicioNum = parseInt(inicioVal);
    if (isNaN(inicioNum) || !validarHorario(inicioNum)) {
        erro.textContent = 'Início inválido. Use formato HHMM (ex: 0900).';
        return;
    }
    const fimNum = parseInt(fimVal);
    if (isNaN(fimNum) || !validarHorario(fimNum)) {
        erro.textContent = 'Fim inválido. Use formato HHMM (ex: 0900).';
        return;
    }

    const dados = {
        nome_usuario: nomeVal,
        tipo_carregador: parseInt(document.getElementById('input-tipo').value),
        inicio_sessao: parseInt(inicioVal),
        fim_sessao: parseInt(fimVal)
    };

    const resultado = iniciarSessao(dados);

    if (!resultado.sucesso) {
        erro.textContent = resultado.erro;
        return;
    }

    adicionarLog(resultado.ocpp_messages);

    const solar = calcularSolar();
    const potencia = calcularPotenciaTotal();
    const ia = decisaoIA(solar, potencia);

    adicionarLog([{ tipo: ia.msg, id_sessao: resultado.sessao.slot, horario: '00:00' }]);

    if (!ia.aprovado) {
        erro.textContent = ia.msg;
        return;
    }

    if (resultado.rebalanceamento.ajustes.length > 0) {
        resultado.rebalanceamento.ajustes.forEach(ajuste => {
            adicionarLog([{
                tipo: `DLB: Slot ${ajuste.sessao_id} ${ajuste.potencia_antiga.toFixed(1)}kW → ${ajuste.potencia_nova.toFixed(1)}kW`,
                id_sessao: ajuste.sessao_id,
                horario: '00:00'
            }]);
        });
    }

    fecharModal();
    atualizarTodos();
}

document.addEventListener('DOMContentLoaded', () => {
    adicionarLog([
        { tipo: 'BootNotification', id_sessao: 0, horario: '00:00' },
        { tipo: 'StatusNotification: Available', id_sessao: 0, horario: '00:00' }
    ]);
    atualizarTodos();
});
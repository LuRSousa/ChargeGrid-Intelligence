const API_BASE = 'http://localhost:3000/api';

// ==========================================
// 1. LOG OCPP
// ==========================================
function adicionarLog(mensagens) {
    const log = document.getElementById('ocpp-log');
    const agora = new Date();
    const ts = agora.getHours().toString().padStart(2, '0') + ':' + agora.getMinutes().toString().padStart(2, '0');

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
    if (tipo.includes('Stop')) return 'error';
    if (tipo.includes('Start')) return 'warn';
    return 'info';
}

function calcularSolarMock() {
    const h = new Date().getHours();
    if (h < 6 || h >= 20) return 0;
    return Math.max(0, Math.round((1 - Math.abs(h - 13) / 7) * 100));
}

// ==========================================
// 2. COMUNICAÇÃO COM O BACKEND (API)
// ==========================================
async function fetchAPI(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error(`Erro na API (${endpoint}):`, error);
        return null;
    }
}

// ==========================================
// 3. ATUALIZAÇÃO DA INTERFACE
// ==========================================
async function atualizarTodos() {
    const demandaRes = await fetchAPI('/sessoes/calcular/demanda');
    const potMaxRes = await fetchAPI('/carregadores/potencia/maxima');

    let demandaTotal = demandaRes ? demandaRes.demanda_total : 0;
    let sessoesAtivasQnt = demandaRes ? demandaRes.qnt_sessoes : 0;
    let potMaxTotal = potMaxRes ? potMaxRes.potencia_maxima_total : 60;

    const carregadoresRes = await fetchAPI('/carregadores/busca/todos/carregadores');
    const carregadores = carregadoresRes && carregadoresRes.sucesso ? carregadoresRes.carregadores : [];

    const sessoesAtivas = await fetchAPI('/sessoes/buscar') || [];

    atualizarMetricas(demandaTotal, sessoesAtivasQnt, potMaxTotal, carregadores.length);
    await renderizarSlotsDinamicos(carregadores, sessoesAtivas);
}

function atualizarMetricas(demandaTotal, sessoesAtivasQnt, potMaxTotal, totalCarregadores) {
    document.getElementById('val-solar').innerHTML = `
        <span class="metric-label">Energia Solar:</span>
        <span class="metric-value">${calcularSolarMock()}%</span>
    `;

    document.getElementById('val-potencia').innerHTML = `
        <span class="metric-label">Potência em uso:</span>
        <span class="metric-value">${Number(demandaTotal || 0).toFixed(1)} kW</span>
    `;

    document.getElementById('val-sessoes').innerHTML = `
        <span class="metric-label">Sessões ativas:</span>
        <span class="metric-value">${sessoesAtivasQnt} / ${totalCarregadores > 0 ? totalCarregadores : 0}</span>
    `;

    const percentual = potMaxTotal > 0 ? (demandaTotal / potMaxTotal) * 100 : 0;
    document.getElementById('val-percentual').innerHTML = `
        <span class="metric-label">Capacidade usada:</span>
        <span class="metric-value">${percentual.toFixed(0)}%</span>
    `;
}

async function renderizarSlotsDinamicos(carregadores, sessoesAtivas) {
    const grid = document.getElementById('chargers-grid');
    grid.innerHTML = '';

    for (const carregador of carregadores) {
        const card = document.createElement('div');

        const sessao = sessoesAtivas.find(s => s.carregador_id === carregador.id);

        if (sessao) {
            // Se tem sessão, pega os dados de energia e custo calculados em tempo real na rota de status
            const statusRes = await fetchAPI(`/sessoes/status/${sessao.id}`);
            const potenciaAtual = statusRes?.potencia_instantanea ?? carregador.potencia_atual;

            card.className = 'charger-card ativo';
            card.innerHTML = `
                <span class="charger-id">Carregador ${carregador.id}</span>
                <span class="charger-nome">Modo: <p class="resultado">${sessao.modo_carga || 'Padrão'}</p></span> 
                <span class="charger-tipo">Status: <p class="resultado">${sessao.sessao_status}</p></span>
                <span class="charger-kw">Potência: <p class="resultado">${Number(potenciaAtual || 0).toFixed(1)} kW</p></span>
                <div class="fim-slot">
                    <span class="charger-status">Carregando</span>
                    <button class="btn-encerrar" onclick="encerrarSessaoBanco(${sessao.id}, ${carregador.id}, '${sessao.cartao_rfid_uid}')">Encerrar</button>
                </div>
            `;
        } else {
            card.className = 'charger-card inativo';
            const emErro = carregador.status_modbus === 'erro';

            card.innerHTML = `
                <span class="charger-id">Carregador ${carregador.id}</span>
                <div class="fim-slot">
                    <span class="charger-status" style="${emErro ? 'color: var(--red); opacity: 1;' : ''}">
                        ${emErro ? 'Erro/Offline' : 'Livre'}
                    </span>
                    <button class="btn-iniciar" onclick="abrirModal(${carregador.id})" ${emErro ? 'disabled' : ''}>+ Iniciar</button>
                </div>
            `;
        }
        grid.appendChild(card);
    }
}

// ==========================================
// 4. MODAL E CRIAÇÃO DE SESSÃO VIA API
// ==========================================
let carregadorAtivoModal = null;

function abrirModal(carregadorId) {
    carregadorAtivoModal = carregadorId;
    document.getElementById('modal-erro').textContent = '';
    document.getElementById('modal-nova-sessao').classList.add('aberto');
}

function fecharModal() {
    document.getElementById('modal-nova-sessao').classList.remove('aberto');
    carregadorAtivoModal = null;
}

async function confirmarSessao() {
    const erro = document.getElementById('modal-erro');
    erro.textContent = 'Aguarde, processando...';

    const rfidsRes = await fetchAPI('/rfids/disponiveis');
    if (!rfidsRes || rfidsRes.length === 0) {
        erro.textContent = 'Erro: Não há nenhum Cartão RFID disponível (em estoque) no banco.';
        return;
    }
    const cartaoUidMock = rfidsRes[0].cartao_rfid_uid;

    const modoCarga = document.getElementById('input-tipo').value;

    const criacaoRes = await fetchAPI('/sessoes/criar', 'POST', {
        cartao_rfid_uid: cartaoUidMock,
        carregador_id: carregadorAtivoModal
    });

    if (!criacaoRes || !criacaoRes.sucesso) {
        erro.textContent = criacaoRes?.erro || 'Falha ao criar sessão.';
        return;
    }
    const sessaoId = criacaoRes.dados.id;

    const inicioRes = await fetchAPI(`/sessoes/iniciar-carregamento/${sessaoId}`, 'PATCH', {
        modo_carga: modoCarga,
        limite_valor: null
    });

    if (!inicioRes || !inicioRes.sucesso) {
        erro.textContent = inicioRes?.erro || 'Falha ao iniciar o carregamento.';
        return;
    }

    adicionarLog([{ tipo: 'StartTransaction', id_sessao: sessaoId }]);

    fecharModal();
    atualizarTodos();
}

// ==========================================
// 5. ENCERRAMENTO E RELATÓRIO VIA API
// ==========================================
async function encerrarSessaoBanco(sessaoId, carregadorId, rfidUid) {
    const statusRes = await fetchAPI(`/sessoes/status/${sessaoId}`);
    if (!statusRes || !statusRes.sucesso) {
        alert('Erro de conexão ao buscar o status final da sessão.');
        return;
    }

    const inicio = new Date(statusRes.dados.inicio_recarga);
    const duracaoMin = Math.round((new Date() - inicio) / 60000);

    const dadosEncerramento = {
        rfid_uid: rfidUid,
        carregador_id: carregadorId,
        duracao_minutos: duracaoMin,
        energia_kwh: statusRes.energia_atual || 0,
        tarifa_aplicada: statusRes.tarifa ?? 0,
        custo_total: statusRes.custo_atual || 0
    };

    const encerraRes = await fetchAPI(`/sessoes/encerrar/${sessaoId}`, 'PATCH', dadosEncerramento);

    if (encerraRes && encerraRes.sucesso) {
        adicionarLog([{ tipo: 'StopTransaction', id_sessao: sessaoId }]);
        mostrarRelatorio(encerraRes.dados, encerraRes.fatura);
        atualizarTodos();
    } else {
        alert('Falha ao tentar encerrar: ' + (encerraRes?.erro || 'Erro desconhecido.'));
    }
}

function mostrarRelatorio(sessao, fatura) {
    const horas = Math.floor((sessao.duracao_minutos || 0) / 60);
    const minutos = (sessao.duracao_minutos || 0) % 60;

    document.getElementById('modal-relatorio-conteudo').innerHTML = `
        <h2>Relatório - Fatura #${fatura ? fatura.id : 'N/D'}</h2>
        <p><strong>Duração:</strong> ${horas}h ${minutos}min</p>
        <p><strong>Status:</strong> Encerrada com sucesso</p>
        <p><strong>Modo:</strong> ${sessao.modo_carga || 'Padrão'}</p>
        <p><strong>Energia:</strong> ${Number(sessao.energia_kwh || 0).toFixed(2)} kWh</p>
        <p><strong>Total:</strong> R$ ${Number(sessao.custo_total || 0).toFixed(2)}</p>
        <button type="button" onclick="fecharRelatorio()">Fechar</button>
    `;
    document.getElementById('modal-relatorio').classList.add('aberto');
}

function fecharRelatorio() {
    document.getElementById('modal-relatorio').classList.remove('aberto');
}

// ==========================================
// 6. INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    adicionarLog([{ tipo: 'BootNotification', id_sessao: 0 }]);

    atualizarTodos();
});

// ==========================================
// 7. TEMA CLARO / ESCURO (Herdado do Mobile)
// ==========================================
const iconeSol = '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
const iconeLua = '<path d="M12 7c0-1.77.72-3.37 1.88-4.53A9.994 9.994 0 0 0 2 12c0 5.52 4.48 10 10 10a9.994 9.994 0 0 0 9.53-6.88A7 7 0 0 1 12 7z"/><circle cx="6.5" cy="8.5" r="0.8"/><circle cx="9" cy="14" r="0.6"/><circle cx="15" cy="16" r="0.7"/>';

function aplicarTema(tema) {
    const icone = document.getElementById('iconeTema');
    if (tema === 'dark') {
        document.body.classList.add('dark-mode');
        if (icone) icone.innerHTML = iconeLua;
    } else {
        document.body.classList.remove('dark-mode');
        if (icone) icone.innerHTML = iconeSol;
    }
}

function alternarTema() {
    const escuroAtivo = document.body.classList.contains('dark-mode');
    const novoTema = escuroAtivo ? 'light' : 'dark';
    aplicarTema(novoTema);
    try { localStorage.setItem('goodwe-tema', novoTema); } catch (e) { }
}

(function iniciarTema() {
    let temaSalvo = 'light';
    try { temaSalvo = localStorage.getItem('goodwe-tema') || 'light'; } catch (e) { }
    aplicarTema(temaSalvo);
})();
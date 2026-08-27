const API_BASE = 'http://localhost:3000/api';
const TARIFA_POR_KWH = 2.50; // estimativa exibida no modal, antes de confirmar

// -----------------------------------------------------------------------
// Mensagens inline — substituem os alert() antigos
// -----------------------------------------------------------------------
function mostrarMensagem(elementId, texto, tipo) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = texto;
  el.className = 'mensagem-inline ' + tipo; // 'erro' ou 'sucesso'
}

function limparMensagem(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.className = 'mensagem-inline';
}

// -----------------------------------------------------------------------
// Mapa (simulação da visão de expansão — não conectado a dados reais)
// -----------------------------------------------------------------------
let map = null;

function inicializarMapa() {
  if (map !== null) return;

  const lat = -23.561684;
  const lng = -46.655981;

  map = L.map('mapa').setView([lat, lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  const postos = [
    { nome: "Posto GoodWe - Paulista", lat: -23.561684, lng: -46.655981, status: "Disponível" },
    { nome: "Posto Parceiro A", lat: -23.555500, lng: -46.660000, status: "Disponível" },
    { nome: "Posto Parceiro B", lat: -23.568000, lng: -46.665000, status: "Ocupado" }
  ];

  postos.forEach(posto => {
    L.marker([posto.lat, posto.lng])
      .addTo(map)
      .bindPopup(`<b>${posto.nome}</b><br>${posto.status}`);
  });
}

// -----------------------------------------------------------------------
// Perfil
// -----------------------------------------------------------------------
async function carregarPerfil() {
  const usuarioId = localStorage.getItem('usuarioId');
  if (!usuarioId) {
    document.getElementById('perfilNome').textContent = 'Não autenticado';
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/usuario/${usuarioId}`);
    const usuario = await resp.json();

    document.getElementById('perfilNome').textContent = usuario.nome;
    document.getElementById('perfilEmail').textContent = usuario.email;
    document.getElementById('perfilTipo').textContent = usuario.tipo_conta === 'operador' ? 'Operador' : 'Cliente';
    document.getElementById('perfilPlano').textContent = usuario.plano === 'vip' ? 'VIP' : 'Padrão';
  } catch (e) {
    document.getElementById('perfilNome').textContent = 'Erro ao carregar';
  }
}

function fazerLogout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

// -----------------------------------------------------------------------
// Navegação entre abas
// -----------------------------------------------------------------------
function trocarAba(idAba, elementoBotao) {
  document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('ativa'));
  document.querySelectorAll('.btn-menu').forEach(btn => btn.classList.remove('ativo'));

  document.getElementById(idAba).classList.add('ativa');
  elementoBotao.classList.add('ativo');

  if (idAba === 'home' && map) {
    setTimeout(() => map.invalidateSize(), 200);
  }
}

// -----------------------------------------------------------------------
// Identificação da sessão via cartão RFID
// -----------------------------------------------------------------------
let sessaoAtivaId = null;
let carregadorAtivoId = null;

async function buscarSessaoAtiva() {
  const uid = document.getElementById('inputRfid').value.trim();
  limparMensagem('mensagemCarro');

  if (!uid) {
    mostrarMensagem('mensagemCarro', 'Digite o UID do cartão.', 'erro');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/sessoes/ativa?id=${encodeURIComponent(uid)}`);
    const dados = await resp.json();

    if (!dados.sucesso) {
      mostrarMensagem('mensagemCarro', dados.erro || 'Nenhuma sessão ativa encontrada para este cartão.', 'erro');
      return;
    }

    sessaoAtivaId = dados.dados.id;
    carregadorAtivoId = dados.dados.carregador_id;
    localStorage.setItem('sessaoAtivaId', sessaoAtivaId);
    localStorage.setItem('carregadorAtivoId', carregadorAtivoId);

    document.getElementById('vincularRFID').style.display = 'none';

    // Se a sessão já estiver carregando, pula direto para o acompanhamento;
    // se ainda estiver só 'iniciada', mostra as opções de início.
    if (dados.dados.sessao_status === 'carregando') {
      mostrarPainelAcompanhamento();
    } else {
      document.getElementById('blocoAcoesIniciais').style.display = 'flex';
      document.getElementById('statusTexto').textContent = 'Status atual: Sessão vinculada';
    }

  } catch (e) {
    mostrarMensagem('mensagemCarro', 'Erro ao conectar com o servidor.', 'erro');
  }
}

// Restaura a sessão ativa se a página for recarregada no meio do fluxo
async function restaurarSessaoDoStorage() {
  const idSalvo = localStorage.getItem('sessaoAtivaId');
  const carregadorSalvo = localStorage.getItem('carregadorAtivoId');
  if (!idSalvo) return;

  sessaoAtivaId = idSalvo;
  carregadorAtivoId = carregadorSalvo;

  document.getElementById('vincularRFID').style.display = 'none';
  document.getElementById('blocoAcoesIniciais').style.display = 'none';
  mostrarPainelAcompanhamento();
}

// -----------------------------------------------------------------------
// Modal — Personalizar Carregamento
// -----------------------------------------------------------------------
let modoSelecionado = 'rapido';

function abrirModal() {
  limparMensagem('mensagemModal');
  document.getElementById('modalCarregamento').classList.add('ativo');
}

function selecionarModo(modo, elemento) {
  modoSelecionado = modo;
  document.querySelectorAll('.modo-opcao').forEach(op => op.classList.remove('selecionado'));
  elemento.classList.add('selecionado');
}

function fecharModal() {
  document.getElementById('modalCarregamento').classList.remove('ativo');
  document.getElementById('inputValor').value = '';
  document.getElementById('valorEmKwh').textContent = '*Tarifa estimativa: R$ 2,50 por kWh';
  document.querySelectorAll('.modo-opcao').forEach(op => op.classList.remove('selecionado'));
  document.querySelector('.modo-opcao[data-modo="rapido"]').classList.add('selecionado');
  modoSelecionado = 'rapido';
  limparMensagem('mensagemModal');
}

function atualizarPorValor() {
  const valor = parseFloat(document.getElementById('inputValor').value);
  const label = document.getElementById('valorEmKwh');

  if (!isNaN(valor) && valor >= 0) {
    const kwhEquivalente = (valor / TARIFA_POR_KWH).toFixed(1);
    label.textContent = `*Aprox. ${kwhEquivalente} kWh — tarifa estimativa: R$ 2,50 por kWh`;
  } else {
    label.textContent = '*Tarifa estimativa: R$ 2,50 por kWh';
  }
}

async function confirmarCarregamento() {
  if (!sessaoAtivaId) {
    mostrarMensagem('mensagemModal', 'Identifique a sessão pelo cartão primeiro.', 'erro');
    return;
  }

  const valor = parseFloat(document.getElementById('inputValor').value);
  if (!valor || valor <= 0) {
    mostrarMensagem('mensagemModal', 'Informe um valor válido.', 'erro');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/sessoes/iniciar-carregamento/${sessaoAtivaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limite_valor: valor, modo_carga: modoSelecionado })
    });
    const dados = await resp.json();

    if (!dados.sucesso) {
      mostrarMensagem('mensagemModal', dados.erro, 'erro');
      return;
    }

    document.getElementById('modalCarregamento').classList.remove('ativo');
    mostrarPainelAcompanhamento();

  } catch (e) {
    mostrarMensagem('mensagemModal', 'Erro ao conectar com o servidor.', 'erro');
  }
}

// -----------------------------------------------------------------------
// Modal — Iniciar Carregamento até a capacidade máxima
// -----------------------------------------------------------------------
function abrirModalMaxima() {
  limparMensagem('mensagemModalMaxima');
  document.getElementById('modalMaxima').classList.add('ativo');
}

function fecharModalMaxima() {
  document.getElementById('modalMaxima').classList.remove('ativo');
}

async function confirmarCarregamentoMaximo() {
  if (!sessaoAtivaId) {
    mostrarMensagem('mensagemModalMaxima', 'Identifique a sessão pelo cartão primeiro.', 'erro');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/sessoes/iniciar-carregamento/${sessaoAtivaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // sem limite_valor — carrega até completar
    });
    const dados = await resp.json();

    if (!dados.sucesso) {
      mostrarMensagem('mensagemModalMaxima', dados.erro, 'erro');
      return;
    }

    document.getElementById('modalMaxima').classList.remove('ativo');
    mostrarPainelAcompanhamento();

  } catch (e) {
    mostrarMensagem('mensagemModalMaxima', 'Erro ao conectar com o servidor.', 'erro');
  }
}

// -----------------------------------------------------------------------
// Painel de acompanhamento — atualização sob demanda (sem polling)
// -----------------------------------------------------------------------
function mostrarPainelAcompanhamento() {
  document.getElementById('blocoAcoesIniciais').style.display = 'none';
  document.getElementById('painelFatura').style.display = 'none';
  document.getElementById('painelAcompanhamento').style.display = 'block';
  document.getElementById('statusTexto').textContent = 'Status atual: Carregando';
  atualizarStatusSessao();
}

async function atualizarStatusSessao() {
  if (!sessaoAtivaId) return;

  try {
    const resp = await fetch(`${API_BASE}/sessoes/status/${sessaoAtivaId}`);
    const dados = await resp.json();

    if (!dados.sucesso) {
      mostrarMensagem('mensagemCarro', dados.erro || 'Erro ao buscar status da sessão.', 'erro');
      return;
    }

    const status = dados.dados.sessao_status;

    if (status === 'encerrada' || status === 'pagamento_pendente') {
      const faturaResp = await fetch(`${API_BASE}/pagamento/buscar/sessao/${sessaoAtivaId}`);
      const faturaDados = await faturaResp.json();

      if (faturaDados.sucesso) {
        mostrarTelaFatura(faturaDados.fatura);
      } else {
        mostrarMensagem('mensagemCarro', 'Sessão encerrada, mas a fatura não foi encontrada.', 'erro');
      }
      return;
    }

    if (status === 'paga') {
      mostrarMensagem('mensagemCarro', 'Esta sessão já foi paga.', 'sucesso');
      resetarParaTelaInicial();
      return;
    }

    const nomesModo = { rapido: 'Rápido', FV: 'Prioridade Solar', FV_baterias: 'Solar + Bateria' };

    document.getElementById('infoStatus').textContent = dados.dados.sessao_status;
    document.getElementById('infoModo').textContent = nomesModo[dados.dados.modo_carga] || dados.dados.modo_carga;
    document.getElementById('infoPotencia').textContent = (dados.potencia_instantanea ?? 0).toFixed(2);
    document.getElementById('infoEnergia').textContent = (dados.energia_atual ?? 0).toFixed(3);
    document.getElementById('infoCusto').textContent = (dados.custo_atual ?? 0).toFixed(2);

    const avisoEl = document.getElementById('infoAvisoLimite');
    if (dados.aviso_limite && dados.aviso_limite.atingido) {
      avisoEl.textContent = 'Você atingiu o limite definido!';
      avisoEl.style.display = 'block';
    } else {
      avisoEl.style.display = 'none';
    }

  } catch (e) {
    mostrarMensagem('mensagemCarro', 'Erro ao conectar com o servidor.', 'erro');
  }
}

// -----------------------------------------------------------------------
// Encerramento e fatura
// -----------------------------------------------------------------------
let faturaAtualId = null;

async function encerrarSessaoAtiva() {
  if (!sessaoAtivaId) return;
  // Confirmação intencional antes de uma ação irreversível — não é um
  // alerta informativo, é uma checagem de segurança antes de encerrar.
  if (!confirm('Deseja realmente encerrar o carregamento?')) return;

  const energia = parseFloat(document.getElementById('infoEnergia').textContent) || 0;
  const custo = parseFloat(document.getElementById('infoCusto').textContent) || 0;

  try {
    const resp = await fetch(`${API_BASE}/sessoes/encerrar/${sessaoAtivaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfid_uid: document.getElementById('inputRfid').value.trim(),
        carregador_id: carregadorAtivoId,
        duracao_minutos: 0,
        energia_kwh: energia,
        tarifa_aplicada: statusRes.tarifa ?? 0,
        custo_total: custo
      })
    });
    const dados = await resp.json();

    if (!dados.sucesso) {
      mostrarMensagem('mensagemCarro', dados.erro, 'erro');
      return;
    }

    mostrarTelaFatura(dados.fatura);

  } catch (e) {
    mostrarMensagem('mensagemCarro', 'Erro ao conectar com o servidor.', 'erro');
  }
}

function mostrarTelaFatura(fatura) {
  document.getElementById('painelAcompanhamento').style.display = 'none';

  if (!fatura) {
    mostrarMensagem('mensagemCarro', 'Sessão encerrada, mas houve um problema ao gerar a fatura.', 'erro');
    resetarParaTelaInicial();
    return;
  }

  faturaAtualId = fatura.id;
  document.getElementById('statusTexto').textContent = 'Status atual: Aguardando pagamento';

  // painelFatura é IRMÃ de painelAcompanhamento — por isso aparece corretamente agora
  document.getElementById('painelFatura').style.display = 'block';
  document.getElementById('faturaEnergia').textContent = fatura.energia_kwh ?? '-';
  document.getElementById('faturaDuracao').textContent = fatura.duracao_minutos ?? '-';
  document.getElementById('faturaValor').textContent = Number(fatura.valor_total ?? 0).toFixed(2);
  document.getElementById('faturaStatus').textContent = `Status: ${fatura.status_pagamento ?? '-'}`;
}

async function pagarFaturaAtual() {
  if (!faturaAtualId) return;

  try {
    const resp = await fetch(`${API_BASE}/pagamento/pagar/${faturaAtualId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metodo_pagamento: 'pix',
        transacao_externa_id: 'TESTE-PWA-' + Date.now()
      })
    });
    const dados = await resp.json();

    if (!dados.sucesso) {
      mostrarMensagem('mensagemCarro', dados.mensagem, 'erro');
      return;
    }

    document.getElementById('faturaStatus').textContent = `Status: ${dados.fatura.status_pagamento}`;

    const botao = document.getElementById('btnPagarFatura');
    botao.textContent = 'Pago ✓';
    botao.disabled = true;
    botao.style.opacity = '0.6';
    botao.style.cursor = 'default';

    setTimeout(resetarParaTelaInicial, 2500);

  } catch (e) {
    mostrarMensagem('mensagemCarro', 'Erro ao conectar com o servidor.', 'erro');
  }
}

function resetarParaTelaInicial() {
  document.getElementById('painelFatura').style.display = 'none';
  document.getElementById('painelAcompanhamento').style.display = 'none';
  document.getElementById('blocoAcoesIniciais').style.display = 'none';
  document.getElementById('vincularRFID').style.display = 'block';
  document.getElementById('inputRfid').value = '';
  document.getElementById('statusTexto').textContent = 'Status atual: Sessão não vinculada';

  const botao = document.getElementById('btnPagarFatura');
  botao.textContent = 'Pagar agora';
  botao.disabled = false;
  botao.style.opacity = '1';
  botao.style.cursor = 'pointer';

  sessaoAtivaId = null;
  carregadorAtivoId = null;
  faturaAtualId = null;
  localStorage.removeItem('sessaoAtivaId');
  localStorage.removeItem('carregadorAtivoId');
}

// -----------------------------------------------------------------------
// Tema claro/escuro
// -----------------------------------------------------------------------
const iconeSol = '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
const iconeLua = '<path d="M12 7c0-1.77.72-3.37 1.88-4.53A9.994 9.994 0 0 0 2 12c0 5.52 4.48 10 10 10a9.994 9.994 0 0 0 9.53-6.88A7 7 0 0 1 12 7z"/><circle cx="6.5" cy="8.5" r="0.8"/><circle cx="9" cy="14" r="0.6"/><circle cx="15" cy="16" r="0.7"/>';

function aplicarTema(tema) {
  const icone = document.getElementById('iconeTema');
  if (tema === 'dark') {
    document.body.classList.add('dark-mode');
    icone.innerHTML = iconeLua;
  } else {
    document.body.classList.remove('dark-mode');
    icone.innerHTML = iconeSol;
  }
}

function alternarTema() {
  const escuroAtivo = document.body.classList.contains('dark-mode');
  const novoTema = escuroAtivo ? 'light' : 'dark';
  aplicarTema(novoTema);
  try {
    localStorage.setItem('goodwe-tema', novoTema);
  } catch (e) {}
}

(function iniciarTema() {
  let temaSalvo = 'light';
  try {
    temaSalvo = localStorage.getItem('goodwe-tema') || 'light';
  } catch (e) {
    temaSalvo = 'light';
  }
  aplicarTema(temaSalvo);
})();

// -----------------------------------------------------------------------
// Inicialização
// -----------------------------------------------------------------------
window.onload = function () {
  inicializarMapa();
  carregarPerfil();
  restaurarSessaoDoStorage();
  resetarParaTelaInicial();
};

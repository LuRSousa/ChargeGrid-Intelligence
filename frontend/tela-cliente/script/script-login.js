const API_BASE = 'http://localhost:3000/api';

// -----------------------------------------------------------------------
// Mensagens inline — mesmo padrão usado em menu.js
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
// Navegação entre os três cartões (login / cadastro / recuperar senha)
// -----------------------------------------------------------------------
function mostrarRecuperar() {
  document.querySelector('.login-card').classList.add('escondido');
  document.getElementById('recoverCard').classList.add('ativo');
  document.getElementById('recoverForm').style.display = 'block';
  document.getElementById('recoverMensagem').classList.remove('ativo');
}

function mostrarCadastro() {
  document.querySelector('.login-card').classList.add('escondido');
  document.getElementById('recoverCard').classList.remove('ativo');
  document.getElementById('registerCard').classList.add('ativo');
}

function mostrarLogin() {
  document.getElementById('registerCard').classList.remove('ativo');
  document.getElementById('recoverCard').classList.remove('ativo');
  document.getElementById('emailRecuperar').value = '';
  document.querySelector('.login-card').classList.remove('escondido');
  limparMensagem('mensagemLogin');
  limparMensagem('mensagemCadastro');
  limparMensagem('mensagemRecuperar');
}

// -----------------------------------------------------------------------
// Recuperação de senha — mock de UI, sem endpoint real no back-end ainda
// -----------------------------------------------------------------------
function enviarRecuperacao(event) {
  event.preventDefault();
  const email = document.getElementById('emailRecuperar').value;

  if (!email) {
    mostrarMensagem('mensagemRecuperar', 'Por favor, informe um e-mail válido.', 'erro');
    return false;
  }

  document.getElementById('emailEnviadoTexto').textContent = email;
  document.getElementById('recoverForm').style.display = 'none';
  document.getElementById('recoverMensagem').classList.add('ativo');
  return false;
}

// -----------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------
async function fazerLogin(event) {
  event.preventDefault();
  limparMensagem('mensagemLogin');

  try {
    const resp = await fetch(`${API_BASE}/usuario/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        senha: document.getElementById('password').value
      })
    });
    const dados = await resp.json();

    if (!resp.ok) {
      mostrarMensagem('mensagemLogin', dados.mensagem || 'E-mail ou senha inválidos.', 'erro');
      return false;
    }

    // A rota /login devolve { mensagem, usuario: {...} } — objeto aninhado,
    // diferente de /criar-novo-usuario que devolve o usuário direto.
    const usuario = dados.usuario;

    if (!usuario || !usuario.id) {
      mostrarMensagem('mensagemLogin', 'Resposta inesperada do servidor.', 'erro');
      return false;
    }

    // Esta é a linha que faltava — sem ela, usuarioId nunca chega no
    // localStorage, e todo o resto do fluxo (vincular sessão, fatura)
    // recebe usuario_id como null a partir daqui.
    localStorage.setItem('usuarioId', usuario.id);
    localStorage.setItem('usuarioNome', usuario.nome);
    localStorage.setItem('usuarioEmail', usuario.email);

    window.location.href = 'menu.html';
    return false;

  } catch (e) {
    mostrarMensagem('mensagemLogin', 'Erro ao conectar com o servidor.', 'erro');
    return false;
  }
}

// -----------------------------------------------------------------------
// Cadastro
// -----------------------------------------------------------------------
async function fazerCadastro(event) {
  event.preventDefault();
  limparMensagem('mensagemCadastro');

  const senha = document.getElementById('senhaCadastro').value;
  const confirmarSenha = document.getElementById('confirmarSenhaCadastro').value;

  if (senha !== confirmarSenha) {
    mostrarMensagem('mensagemCadastro', 'As senhas não coincidem.', 'erro');
    return false;
  }

  const ehOperador = document.getElementById('operadorSim').checked;

  try {
    const resp = await fetch(`${API_BASE}/usuario/criar-novo-usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: document.getElementById('nomeCompleto').value,
        email: document.getElementById('emailCadastro').value,
        senha: senha,
        tipo_conta: ehOperador ? 'operador' : 'cliente'
      })
    });
    const dados = await resp.json();

    if (!resp.ok) {
      mostrarMensagem('mensagemCadastro', dados.mensagem || 'Erro ao cadastrar.', 'erro');
      return false;
    }

    // /criar-novo-usuario devolve o usuário direto (sem aninhar em "usuario")
    if (!dados.id) {
      mostrarMensagem('mensagemCadastro', 'Resposta inesperada do servidor.', 'erro');
      return false;
    }

    localStorage.setItem('usuarioId', dados.id);
    localStorage.setItem('usuarioNome', dados.nome);
    localStorage.setItem('usuarioEmail', dados.email);

    window.location.href = 'menu.html';
    return false;

  } catch (e) {
    mostrarMensagem('mensagemCadastro', 'Erro ao conectar com o servidor.', 'erro');
    return false;
  }
}
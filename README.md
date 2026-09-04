# ChargeGrid Intelligence — Sistema de Gestão de Recarga de Veículos Elétricos

> **FIAP + GoodWe · EV Challenge 2026**
> **Turma:** 1CCPG
> **Status:** Fluxo principal funcional e implantado — protótipo físico e integração de pagamento em desenvolvimento

---

## Sumário

- [Sobre o Projeto](#sobre-o-projeto)
- [O Que Já Funciona](#o-que-já-funciona)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar Localmente](#como-executar-localmente)
- [Ambiente Publicado](#ambiente-publicado)
- [Roadmap](#roadmap)
- [Divisão de Tarefas](#divisão-de-tarefas)
- [Equipe](#equipe)

---

## Sobre o Projeto

O **ChargeGrid Intelligence** é uma plataforma de gestão de recarga de veículos elétricos para **ambientes comerciais** (shoppings, estacionamentos, postos de combustível). O sistema orquestra múltiplos carregadores da linha GoodWe HCA G2, controla a demanda de energia em tempo real, cobra os usuários por sessão de recarga e serve tanto o motorista quanto o operador do estabelecimento.

### Pilares do Sistema

| Pilar | Descrição | Status |
|:------|:----------|:------:|
| **Controle de Demanda** | Algoritmo de rebalanceamento (*water-filling*) que distribui a potência disponível entre carregadores de capacidades diferentes (7kW/11kW/22kW), sem desperdiçar capacidade contratada | Implementado e testado |
| **Protocolos Abertos** | Linha HCA G2 se comunica via Modbus TCP (confirmado pela GoodWe); protótipo físico (ESP32 + NFC) em desenvolvimento como interface com o backend | Simulado por eventos — hardware real em prototipagem |
| **Tarifação e Pagamento** | Cobrança dinâmica por sessão, ajustada por horário de pico, demanda da rede e modo de carregamento escolhido | Cálculo implementado; Gateway de pagamento simulado |
| **IA Aplicada** | Motor de regras que decide tarifa e distribuição de energia em tempo real — o "raciocínio" por trás do sistema, não uma interface decorativa | Implementado; Previsão preditiva de picos é próximo passo |

---

## O Que Já Funciona

- **Cadastro, login e perfil de usuário** (cliente e operador), com autenticação via hash de senha
- **Ciclo completo de sessão de recarga**: leitura de cartão RFID → personalização (limite de valor + modo de carregamento) → carregamento → encerramento → fatura → pagamento
- **Rebalanceamento de potência por evento** (início/fim de sessão), sem depender de polling contínuo, testado com múltiplos carregadores de potências diferentes
- **Limite de demanda calculado dinamicamente**, como 80% da soma da potência instalada no posto — não é um valor fixo
- **PWA funcional** para o cliente (instalável, com service worker, tema claro/escuro, acompanhamento de sessão sob demanda)
- **Dashboard funcional** para o operador (visão de todos os carregadores, métricas agregadas, encerramento manual de sessão)
- **API REST completa**, cobrindo sessões, carregadores, cartões RFID, usuários e faturas
- **Implantado publicamente** (ver [Ambiente Publicado](https://chargegrid-intelligence-production.up.railway.app/login.html))

---

## Arquitetura do Sistema

### Camada de Apresentação

| Interface 1 — Dashboard do Operador | Interface 2 — PWA do Cliente |
|:-------------------------------------|:-------------------------------|
| Painel com todos os carregadores em tempo real | Login, cadastro e perfil |
| Métricas agregadas (demanda, sessões ativas, capacidade usada) | Vínculo de sessão via cartão RFID |
| Criação e encerramento manual de sessão | Personalização (limite de valor + modo de carregamento) |
| Log estilo OCPP das transações | Acompanhamento sob demanda + fatura + pagamento |
| HTML5 · CSS3 · JavaScript (Vanilla) | HTML5 · CSS3 · JavaScript (Vanilla) · PWA instalável |

### Fluxo de Dados Principal

```
1. Cliente aproxima o cartão RFID no carregador
        ↓
2. Backend cria a sessão (status: "iniciada")
        ↓
3. Cliente lê o mesmo RFID no celular (PWA) e personaliza a recarga
        ↓
4. Sessão transiciona para "carregando" — dispara rebalanceamento
        ↓
5. Cliente, operador ou o carregador físico podem encerrar a sessão
        ↓
6. Backend calcula energia, tarifa e custo — gera a fatura automaticamente
        ↓
7. Pagamento confirma a fatura e libera o cartão/carregador
```

Todo o rebalanceamento e as atualizações de status acontecem **por evento** (início e fim de sessão) — não há polling contínuo no backend. A checagem de consumo em tempo real (`GET /sessoes/status/:id`) é feita **sob demanda**, quando o PWA ou o dashboard pedem, não em loop.

---

## Stack Tecnológica

| Componente | Tecnologia | Situação |
|:-----------|:-----------|:---------|
| **Back-end** | Node.js + Express | Em produção |
| **Banco de Dados** | MySQL (via `mysql2/promise`) | Em produção (Railway) |
| **Front-end (Dashboard)** | HTML5, CSS3, JavaScript (Vanilla) | Funcional |
| **Front-end (PWA)** | HTML5, CSS3, JavaScript (Vanilla), Service Worker, Web App Manifest | Funcional e instalável |
| **Pagamento** | Confirmação de status real via API própria | Gateway externo (Mercado Pago/PIX) ainda não integrado |
| **Comunicação com o carregador** | Simulação orientada a eventos via API REST | Modbus TCP real é o protocolo confirmado da linha HCA G2; ainda depende de acesso ao hardware físico |
| **Protótipo físico** | ESP32 + leitor NFC | Em desenvolvimento — simula o carregador comunicando via REST com o backend |
| **IA** | Módulo de regras em JavaScript (tarifação dinâmica + rebalanceamento) | Implementado; Previsão preditiva de picos é roadmap |
| **Hospedagem** | Railway (Backend + MySQL) | Ativo |

---

## Estrutura do Projeto

```
chargegrid-intelligence/
│
├── src/                             # Servidor Node.js
│   ├── server.js                    # Ponto de entrada + arquivos estáticos
│   ├── db.js                        # Conexão MySQL
│   ├── logic.js                     # Regras de negócio (tarifa, rebalanceamento, etc.)
│   ├── routes/
│   │   ├── sessoes.js
│   │   ├── carregadores.js
│   │   ├── pagamento.js
│   │   ├── rfids.js
│   │   └── usuario.js
│   └── models/
│       ├── SessaoModel.js
│       ├── CarregadorModel.js
│       ├── UsuarioModel.js
│       ├── RFIDModel.js
│       └── FaturaModel.js
│
├── sql/
│   └── schema.sql                   # Script do banco
│
├── frontend/
│   ├── tela-cliente/                # PWA (Interface 2)
│   │   ├── login.html
│   │   ├── menu.html
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   ├── style/
│   │   ├── script/
│   │   └── icons/
│   │
│   └── tela-operador/               # Dashboard (Interface 1)
│       ├── dashboard.html
│       ├── style/
│       └── script/
│
├── .env.example
├── package.json
└── README.md
```

> O back-end fica na raiz do repositório (não numa subpasta) para simplificar a configuração de deploy no Railway.

---

## Como Executar Localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão LTS)
- [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) com Workbench

### Passos

**1. Clone o repositório**

```bash
git clone https://github.com/LuRSousa/ChargeGridIntelligence-Sprint2.git
cd ChargeGridIntelligence-Sprint2
```

**2. Instale as dependências**

```bash
npm install
```

**3. Crie o banco de dados**

- Abra o MySQL Workbench
- Execute: `CREATE DATABASE chargegrid_db;`
- Rode o script `sql/schema.sql`

**4. Configure as variáveis de ambiente**

Copie `.env.example` para `.env` e preencha:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=SUA_SENHA
DB_NAME=chargegrid_db
```

**5. Inicie o servidor**

```bash
node src/server.js
```

**6. Teste a conexão**

Acesse `http://localhost:3000/health` — deve retornar `{"status":"ok","db":"connected"}`

**7. Acesse as interfaces**

- PWA do cliente: `http://localhost:3000/login.html`
- Dashboard do operador: `http://localhost:3000/dashboard`

Ambas as interfaces são servidas pelo próprio Express — não precisam de um servidor separado.

---

## Ambiente Publicado

O backend está implantado no **Railway**, junto com o banco MySQL, permitindo que qualquer integrante da equipe — e o protótipo físico (ESP32) — testem contra o mesmo ambiente, sem depender de uma máquina local ligada.

---

## Roadmap

O que ainda está por vir, tratado como evolução consciente do projeto, não como pendência escondida:

- **Integração real com gateway de pagamento** (Mercado Pago / PIX) — hoje a confirmação de pagamento já atualiza o estado real do sistema, falta só plugar o provedor externo
- **Protótipo físico com ESP32 + leitor NFC**, simulando fisicamente um carregador HCA G2 e se comunicando com a API já existente
- **Integração com hardware Modbus TCP real**, assim que houver acesso físico a um carregador GoodWe
- **Camada de IA preditiva**, antecipando picos de consumo a partir do histórico de sessões
- **Expansão de posto único para múltiplos postos conectados**, com visão comparativa para o cliente e gestão de rede para o operador

---

## Divisão de Tarefas

| Papel | Responsabilidade | Status |
|:------|:------------------|:------:|
| **M1 — Backend Foundation** | Servidor Node.js + Express + MySQL | Concluído |
| **M2 + M6 — Protótipo Físico** | ESP32 + leitor NFC simulando o carregador, integração via API REST | Em desenvolvimento |
| **M3 — API REST** | Rotas de sessões, carregadores, RFID, usuários e faturas | Concluído |
| **M4 — Interface do Cliente (PWA)** | Scripts de login e menu, integração com a API | Em desenvolvimento |
| **M5 — Interface do Operador (Dashboard)** | Estrutura, integração com a API, métricas | Concluído |
| **M7 — Pagamento + IA** | Fluxo de fatura, lógica de tarifação dinâmica | Fatura concluída; gateway externo pendente |

---

## Equipe

| Nome | RM |
|:-----|:---|
| Caio Henrique Ferraz da Silva | RM568992 |
| Enzo Caruso Peter | RM570908 |
| Leonardo Figueredo dos Santos | RM573653 |
| Leonardo Robert Maulicino | RM570329 |
| Matheus Pimenta Martini | RM569400 |
| Pablo Renato dos Santos Sobral de Carvalho | RM569894 |

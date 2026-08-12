# ChargeGrid Intelligence — Sistema de Gestão de Recarga de Veículos Elétricos

> **FIAP + GoodWe · EV Challenge 2026**  
> **Turma:** 1CCPG  
> **Status:** Em desenvolvimento

---

## 📋 Sumário

- [Sobre o Projeto](#sobre-o-projeto)
- [Arquitetura do Sistema](#arquitetura-do-sistema)
- [Stack Tecnológica](#stack-tecnológica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar (Backend)](#como-executar-backend)
- [Como Executar (Frontend)](#como-executar-frontend)
- [Divisão de Tarefas](#divisão-de-tarefas)
- [Equipe](#equipe)

---

## Sobre o Projeto

O **ChargeGrid Intelligence** é uma plataforma de gestão de recarga de veículos elétricos para **ambientes comerciais** (shoppings, condomínios, postos de combustível). O sistema gerencia múltiplos carregadores, controla a demanda de energia, cobra os usuários por sessão e otimiza o uso de energia solar disponível.

Este é o **entregável final do Challenge GoodWe/FIAP**, com prazo até outubro de 2026.

### Pilares do Sistema

| Pilar | Descrição |
|:------|:----------|
| **Controle de Demanda** | Dynamic Load Balancing (DLB) distribui automaticamente a potência disponível entre os carregadores ativos |
| **Protocolos Abertos** | Comunicação via **Modbus TCP** com carregadores HCA G2 (GoodWe) |
| **Tarifação e Pagamento** | Cobrança dinâmica por sessão com ajustes por horário de pico e demanda |
| **Inteligência Artificial** | Previsão de picos de consumo, ajuste dinâmico de tarifa e otimização energética |

---

## Arquitetura do Sistema

### Camada de Apresentação

| Interface 1 — Dashboard do Operador | Interface 2 — PWA Mobile |
|:------------------------------------|:-------------------------|
| Painel de monitoramento em tempo real | App do cliente e do atendente |
| Gráficos de consumo e alertas de demanda | Leitura de RFID via Web NFC API |
| Controle de rebalanceamento de potência | Resumo de sessão e pagamento |
| HTML5 · CSS3 · JavaScript (Vanilla) | HTML5 · CSS3 · JS · Web NFC API |

**Interface 2 e API em desenvolvimento**.

### Fluxo de Dados Principal

```
1. Hardware (HCA G2)   →  Comunica via Modbus TCP (registradores)
2. Polling             →  Lê registradores a cada 30s e detecta eventos
3. Banco de Dados      →  Persiste sessões, usuários, faturas e logs (MySQL)
4. API (Node.js)       →  Expõe dados para os front-ends
5. Dashboard           →  Exibe métricas e alertas para o operador
6. PWA                 →  Permite que o cliente veja a sessão e pague via PIX
```

---

## Stack Tecnológica

| Componente | Tecnologia | Justificativa |
|:-----------|:-----------|:--------------|
| **Back-end** | Node.js + Express | Lógica já implementada em JS, facilidade com Modbus e integrações |
| **Banco de Dados** | MySQL (via `mysql2/promise`) | Estrutura relacional para faturas, usuários e histórico |
| **Front-end (Dashboard)** | HTML5, CSS3, JavaScript (Vanilla) | Já existente, adaptação rápida para consumir API |
| **Front-end (PWA)** | HTML5, CSS3, JS + Web NFC API | Mobile-first, instalável, leitura de RFID sem app nativo |
| **Pagamento** | Mercado Pago (SDK Node.js) | Sandbox gratuito, suporte a PIX e webhooks |
| **Modbus** | `modbus-serial` (Node.js) | Biblioteca madura para TCP/RTU, fácil substituição de simulação |
| **IA** | Módulo próprio em JavaScript | Previsão de pico por médias históricas; ajuste dinâmico de tarifa |

---

## Estrutura Planejada do Projeto

```
chargegrid-intelligence/
│
├── backend/                        # Servidor Node.js
│   ├── src/
│   │   ├── logic.js                # Regras de negócio
│   │   ├── routes/                 # Rotas da API
│   │   │   ├── sessoes.js
│   │   │   ├── metricas.js
│   │   │   ├── pagamento.js
│   │   │   └── webhook.js
│   │   ├── models/                 # Models do banco
│   │   │   ├── SessaoModel.js
│   │   │   ├── UsuarioModel.js
│   │   │   └── FaturaModel.js
│   │   └── services/               # Serviços externos
│   │       ├── modbusSimulator.js
│   │       ├── modbusClient.js
│   │       ├── polling.js
│   │       └── ia.js
│   ├── sql/
│   │   └── schema.sql              # Script do banco
|   ├── db.js                       # Conexão MySQL
|   ├── server.js                   # Ponto de entrada
│   ├── .env.example                # Exemplo de variáveis
│   └── package.json
│
├── frontend/                       # Dashboard do operador (Interface 1)
│   ├── index.html
│   ├── app.js
│   ├── script.js
│   ├── style.css
│   └── style.scss
│
├── pwa/                            # Aplicativo mobile (Interface 2)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── style.css
│   └── app.js
│
├── docs/                           # Documentação
│   ├── api.md
│   ├── arquitetura.md
│   └── base.md
│
├── .gitignore
└── README.md
```

---

## Como Executar (Backend)

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão LTS)
- [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) com Workbench

### Passos

**1. Clone o repositório**

```bash
git clone https://github.com/LuRSousa/ChargeGridIntelligence-Sprint2.git
cd ChargeGridIntelligence-Sprint2/backend
```

**2. Instale as dependências**

```bash
npm install
```

**3. Crie o banco de dados**

- Abra o MySQL Workbench
- Execute: `CREATE DATABASE chargegrid;`
- Depois rode o script `sql/schema.sql`

**4. Configure as variáveis de ambiente**

Copie `.env.example` para `.env` e preencha com suas credenciais:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=SUA_SENHA
DB_NAME=chargegrid
```

**5. Inicie o servidor**

```bash
# Modo desenvolvimento (com auto-reload)
npx nodemon server.js

# Ou modo normal
node server.js
```

**6. Teste a conexão**

Acesse no navegador: `http://localhost:3000/health`

Deve retornar: `{"status":"ok","db":"connected"}`

---

## Como Executar (Frontend)

### Interface 1 — Dashboard do Operador

1. Navegue até a pasta `frontend/`
2. Abra o arquivo `index.html` no navegador
3. Simule os carregadores digitando dados manualmente (automação em desenvolvimento)

---

## Divisão de Tarefas

| Membro | Papel | Responsabilidade |
|:-------|:------|:-----------------|
| M1 | Backend Foundation | Servidor Node.js + Express + MySQL |
| M2 | Banco + Lógica de Negócio | Schema, models e regras de negócio |
| M3 | API REST | Rotas da API e testes |
| M4 | Interface 1 (Dashboard) | Adaptar frontend para consumir API |
| M5 | Interface 2 (PWA) | Estrutura do PWA, NFC e pagamento |
| M6 | Modbus + Polling | Simulador, polling loop e integração |
| M7 | Pagamento + IA | Mercado Pago e módulo de IA |

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
# ChargeGrid Intelligence — GoodWe
### Sistema Inteligente de Gerenciamento de Recarga de Veículos Elétricos

> Sprint 2 — Prova de Conceito Funcional | FIAP 1CCPG | 2026

---

## Integrantes

| Nome | RM | Turma |
|---|---|---|
| Caio Henrique Ferraz da Silva | RM568992 | 1CCPG |
| Enzo Caruso Peter | RM570908 | 1CCPG |
| Leonardo Figueredo dos Santos | RM573653 | 1CCPG |
| Leonardo Robert Maulicino | RM570329 | 1CCPG |
| Lucas Ramos de Sousa | RM573901 | 1CCPG |

---

## Sobre o Projeto

O **ChargeGrid Intelligence** é uma prova de conceito de um sistema de gerenciamento de recarga de veículos elétricos para ambientes comerciais, desenvolvido como evolução da pesquisa realizada na Sprint 1 do GoodWe Challenge.

O sistema simula em tempo real o funcionamento de uma estação de recarga comercial com múltiplos pontos, abordando os quatro pilares estratégicos definidos na Sprint 1:

- **Controle de Demanda** — Dynamic Load Balancing (DLB) distribui automaticamente a potência disponível entre os carregadores ativos
- **Protocolos Abertos** — Simulação do protocolo OCPP com eventos reais (BootNotification, StartTransaction, StopTransaction, MeterValues)
- **Tarifação e Pagamento** — Cálculo dinâmico de tarifa por sessão com ajustes por horário de pico, demanda total e número de sessões ativas
- **Inteligência Artificial** — Módulo de decisão que analisa geração solar disponível e condições de demanda para otimizar o carregamento

---

## Funcionalidades

- Gerenciamento de até 5 sessões de recarga simultâneas
- Rebalanceamento automático de potência ao iniciar ou encerrar uma sessão
- Tarifação dinâmica: +15% em alta demanda, +20% em horário de pico (18h–21h)
- Limite de 24 kW por carregador (40% da capacidade total de 60 kW)
- Log OCPP em tempo real com classificação por tipo de evento
- Decisão de IA por sessão baseada em geração solar e condições da rede
- Desconto de 15% na tarifa quando geração solar ultrapassa 60% da capacidade
- Relatório detalhado ao encerrar cada sessão (energia, tarifa, custo total, duração)

---

## Arquitetura do Sistema

```
index.html          → Estrutura da interface (slots, métricas, modais, log)
     │
     ├── script.js  → Lógica de negócio (independente de interface)
     │      │
     │      ├── class Sessao          (estrutura de dados)
     │      ├── calcularPotenciaTotal()
     │      ├── calcularTarifa()      (dinâmica com pico e demanda)
     │      ├── rebalancearPotencias() (DLB)
     │      ├── simularOcpp()         (protocolo aberto)
     │      ├── iniciarSessao()
     │      └── encerrarSessao()
     │
     └── app.js     → Interface (consome script.js, atualiza o DOM)
            │
            ├── renderizarSlots()     (estado visual dos carregadores)
            ├── atualizarMetricas()   (potência, sessões, capacidade)
            ├── confirmarSessao()     (fluxo do formulário modal)
            ├── calcularSolar()       (simulação de geração fotovoltaica)
            ├── decisaoIA()           (módulo de decisão inteligente)
            └── adicionarLog()        (log OCPP em tempo real)

style.scss → Estilos em SCSS compilados para style.css
```

**Fluxo de uma sessão:**
```
Usuário clica "+ Iniciar"
    → Modal abre
    → Preenche nome, tipo de carregador, horário
    → confirmarSessao() valida e chama iniciarSessao()
    → DLB redistribui potência entre todos os slots ativos
    → IA analisa geração solar: se > 60%, aplica desconto de 15% na tarifa e registra no log OCPP
    → Slot atualiza para estado "Carregando"
    → Usuário clica "Encerrar"
    → Relatório gerado com energia, tarifa e custo
```

---

## Como Executar

Não requer instalação, servidor ou dependências externas.

1. Clone ou baixe o repositório
2. Abra o arquivo `index.html` diretamente no navegador
3. O sistema inicializa automaticamente com o boot do protocolo OCPP

```bash
# Opcional — clonar via Git
git clone https://github.com/seu-usuario/chargegrid-intelligence.git
cd chargegrid-intelligence
# Abrir index.html no navegador
```

---

## Estrutura de Arquivos

```
chargegrid-intelligence/
├── index.html      # Página principal da aplicação
├── script.js       # Lógica de negócio (DLB, tarifação, OCPP, sessões)
├── app.js          # Interface e integração com o DOM
├── style.scss      # Estilos em SCSS (fonte)
├── style.css       # CSS compilado (gerado automaticamente)
└── README.md
```

---

## Evolução em relação à Sprint 1

| Sprint 1 | Sprint 2 |
|---|---|
| Análise teórica dos 4 pilares | Implementação funcional dos 4 pilares |
| Problemas identificados | Soluções implementadas em código |
| Propostas de DLB e tarifação | DLB e tarifação funcionando em tempo real |
| IA descrita como conceito | IA funcional: desconto solar aplicado automaticamente na tarifa |
| Documentação em PDF | Prova de conceito interativa no navegador |

---

## Tecnologias

- HTML5 / CSS3 / JavaScript (ES6+)
- SCSS para estilização
- Sem frameworks ou dependências externas
- Compatível com qualquer navegador moderno

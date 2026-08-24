# Documentação do Banco de Dados

---

## 1. Normatização de Nomenclatura

### a. Nomes de tabelas e de colunas

* Nomes de tabelas e de colunas devem estar em português;

### b. Tabelas

* Tabelas devem ter título capitalizados e no plural;

### c. Colunas

* Colunas devem ser nomeadas em notação `snake_case` (palavras separadas por "_" e em caixa baixa);

### d. Foreign Keys

* Foreign Keys (chaves estrangeiras) devem referenciar a tabela-pai (tabela cuja coluna faz referência);

### e. Identificadores

* Colunas que contenham a palavra "id" devem colocá-lo em útlimo;

---

## 2. Inventário de Dados

| Tabela         | Finalidade                                                       |
| -------------- | ---------------------------------------------------------------- |
| `Usuarios`     | Cadastro e classificação dos usuários do sistema                 |
| `Cartoes_rfid` | Cadastro e controle dos cartões RFID utilizados nos carregadores |
| `Carregadores` | Cadastro, configuração e estado atual dos carregadores           |
| `Sessoes`      | Registro das recargas realizadas                                 |
| `Faturas`      | Registro financeiro associado às sessões                         |
| `Logs_Modbus`  | Registro das comunicações/leitura de registradores Modbus        |

---

## 3. Inventário de Colunas por Domínio

### A. Identidade

* `Usuarios.id`
* `Usuarios.nome`
* `Usuarios.email`
* `Usuarios.tipo_conta`
* `Usuarios.plano`
* `Usuarios.desconto_percentual`

### B. Identificação de Componentes

* `Cartoes_rfid.cartao_rfid_uid`
* `Carregadores.numero_serie`
* `Carregadores.modelo`

### C. Operação dos Carregadores

* `potencia_maxima`
* `potencia_atual`
* `status_modbus`
* `endereco_ip`
* `porta_modbus`

### D. Recarga

* `inicio_recarga`
* `fim_recarga`
* `duracao_minutos`
* `potencia_media`
* `energia_kwh`
* `modo_carga`
* `sessao_status`

### E. Tarifação

* `tarifa_aplicada`
* `custo_total`
* `limite_valor`
* `desconto_aplicado`

### F. Pagamento

* `status_pagamento`
* `metodo_pagamento`
* `transacao_externa_id`
* `data_emissao`
* `data_pagamento`

### G. Integração/Diagnóstico

* `endereco_registrador`
* `valor_bruto`
* `valor_convertido`
* `sucesso`
* `erro`
* `gerado_em`

---

## 4. Relacionamentos do Modelo

### `Usuarios` → `Sessoes`

**Cardinalidade conceitual:** `1:N`

> Um usuário pode estar associado a várias sessões e cada sessão precisa ter um usuário.

---

### `Cartoes_rfid` → `Sessoes`

**Cardinalidade conceitual:** `1:N`

> Um cartão pode aparecer em várias sessões ao longo do tempo.

---

### `Carregadores` → `Sessoes`

**Cardinalidade conceitual:** `1:N`

> Um carregador pode realizar várias sessões ao longo do tempo e cada sessão precisa ter um carregador.

---

### `Sessoes` → `Faturas`

**Cardinalidade conceitual:** `1:N`

> Para representar uma relação 1:1, `Faturas.sessao_id` deveria ser `UNIQUE`.

> Uma sessão pode estar associada a várias faturas, pois `sessao_id` não possui `UNIQUE`.

---

### `Usuarios` → `Faturas`

**Cardinalidade conceitual:** `1:N`

> Um usuário pode possuir várias faturas.

---

### `Carregadores` → `Logs_Modbus`

**Cardinalidade conceitual:** `1:N`

> Um carregador pode gerar vários registros de comunicação cada registro precisa vir de um carregador.

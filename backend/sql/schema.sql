CREATE TABLE Usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(250) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL, 
    tipo_conta VARCHAR(30) CHECK (tipo_conta IN ('cliente', 'operador')) DEFAULT 'cliente',
    plano VARCHAR(15) CHECK (plano IN ('padrao', 'vip')) DEFAULT 'padrao',
    desconto_percentual DECIMAL(5,2),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Cartoes_rfid (
    cartao_rfid_uid VARCHAR(100) PRIMARY KEY,
    status_cartao_rfid VARCHAR(20) CHECK (status_cartao_rfid IN ('estoque', 'em_uso', 'bloqueado')) DEFAULT 'estoque',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Carregadores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_serie VARCHAR(100) NOT NULL UNIQUE,
    modelo VARCHAR(100) NOT NULL,
    localizacao VARCHAR(255) NOT NULL,  
    potencia_maxima DECIMAL(10,2) DEFAULT NULL,
    endereco_ip VARCHAR(50) DEFAULT NULL,
    porta_modbus INT DEFAULT NULL,
    status_modbus VARCHAR(25) CHECK (status_modbus IN ('ocioso', 'aguardando_inicio_sessao', 'em_uso', 'pagamento_pendente', 'erro')) DEFAULT 'ocioso',
    potencia_atual DECIMAL(10,2),
    instalado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Sessoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carregador_id INT,
    cartao_rfid_uid VARCHAR(100) NOT NULL,
    usuario_id INT,
    inicio_recarga DATETIME NOT NULL,
    fim_recarga DATETIME,
    duracao_minutos INT,
    potencia_media DECIMAL(10, 2),
    energia_kwh DECIMAL(10, 3),
    tarifa_aplicada DECIMAL(10, 4),
    custo_total DECIMAL(10,2) DEFAULT NULL,
    limite_valor DECIMAL(10,2) DEFAULT NULL,
    sessao_status VARCHAR(30) CHECK(sessao_status IN ('iniciada', 'carregando', 'encerrada', 'cancelada', 'pagamento_pendente', 'paga')) DEFAULT 'iniciada',
    modo_carga VARCHAR(30) CHECK (modo_carga IN ('rapido', 'FV', 'FV_baterias')) DEFAULT 'rapido',
    criada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizada_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (carregador_id) REFERENCES Carregadores(id), 
    FOREIGN KEY (cartao_rfid_uid) REFERENCES Cartoes_rfid (cartao_rfid_uid),
    FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) 
);

CREATE TABLE Faturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sessao_id INT,
    usuario_id INT,
    valor_total DECIMAL(10,2) NOT NULL,
    desconto_aplicado DECIMAL(10,2) DEFAULT 0.00,
    status_pagamento VARCHAR(30) CHECK (status_pagamento IN ('pendente', 'pago', 'cancelado', 'estornado')) DEFAULT 'pendente',
    metodo_pagamento VARCHAR(30) CHECK (metodo_pagamento IN ('pix', 'cartao_credito', 'cartao_debito')),
    transacao_externa_id VARCHAR(120),
    data_emissao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_pagamento DATETIME DEFAULT NULL,

    FOREIGN KEY (sessao_id) REFERENCES Sessoes (id),
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
);

CREATE TABLE Logs_Modbus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carregador_id INT, 
    endereco_registrador VARCHAR(100) NOT NULL,
    valor_bruto VARCHAR(100),
    valor_convertido VARCHAR(100),
    sucesso BOOLEAN,
    erro VARCHAR(300),
    gerado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (carregador_id) REFERENCES Carregadores (id)
);

/* 

=== DICIONÁRIO DE DADOS ===

1. Normatização de Nomenclatura

    a. Nomes de tabelas e de colunas devem estar em português;
    b. Tabelas devem ter título capitalizados e no plural;
    c. Colunas devem ser nomeadas em notação snake_case (palavras separadas por "_" e em caixa baixa);
    d. Foreign Keys (chaves estrangeiras) devem referenciar a tabela-pai (tabela cuja coluna faz referência);
    e. Colunas que contenham a palavra "id" devem colocá-lo em útlimo;

2. Inventário de dados

| Tabela         | Finalidade                                                       |
| -------------- | ---------------------------------------------------------------- |
|  Usuarios      | Cadastro e classificação dos usuários do sistema                 |
|  Cartoes_rfid  | Cadastro e controle dos cartões RFID utilizados nos carregadores |
|  Carregadores  | Cadastro, configuração e estado atual dos carregadores           |
|  Sessoes       | Registro das recargas realizadas                                 |
|  Faturas       | Registro financeiro associado às sessões                         |
|  Logs_Modbus   | Registro das comunicações/leitura de registradores Modbus        |

3. Inventário de colunas por domínio

    a. Identidade

        Usuarios.id
        Usuarios.nome
        Usuarios.email
        Usuarios.tipo_conta
        Usuarios.plano
        Usuarios.desconto_percentual

    b. Identificação de componentes

        Cartoes_rfid.cartao_rfid_uid
        Carregadores.numero_serie
        Carregadores.modelo

    c. Operação dos carregadores 

        potencia_maxima
        potencia_atual
        status_modbus
        endereco_ip
        porta_modbus
    
    D. Recarga
    
        inicio_recarga
        fim_recarga
        duracao_minutos
        potencia_media
        energia_kwh
        modo_carga
        sessao_status

    E. Tarifação

        tarifa_aplicada
        custo_total
        limite_valor
        desconto_aplicado

    F. Pagamento

        status_pagamento
        metodo_pagamento
        transacao_externa_id
        data_emissao
        data_pagamento

    G. Integração/diagnóstico

        endereco_registrador
        valor_bruto
        valor_convertido
        sucesso
        erro
        gerado_em

4. Relacionamentos do modelo

| Relacionamento                 | Cardinalidade conceitual | Função                                                                                               |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `Usuarios` → `Sessoes`         | 1:N                      | Um usuário pode estar associado a várias sessões e cada sessão precisa ter um usuário                |
| `Cartoes_rfid` → `Sessoes`     | 1:N                      | Um cartão pode aparecer em várias sessões ao longo do tempo.                                         |
| `Carregadores` → `Sessoes`     | 1:N                      | Um carregador pode realizar várias sessões ao longo do tempo e cada sessão precisa ter um carregador |
| `Sessoes` → `Faturas`          | 1:N (Para representar uma relação 1:1, Faturas.sessao_id deveria ser UNIQUE)                   | Uma sessão pode estar associada a várias faturas, pois `sessao_id` não possui `UNIQUE`.           |
| `Usuarios` → `Faturas`         | 1:N                      | Um usuário pode possuir várias faturas.                                                              | 
| `Carregadores` → `Logs_Modbus` | 1:N                      | Um carregador pode gerar vários registros de comunicação cada registro precisa vir de um carregador. |


*/
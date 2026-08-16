CREATE TABLE Usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR (250) NOT NULL,
    email VARCHAR (150) NOT NULL,
    senha_hash VARCHAR (255) NOT NULL, 
    tipo_conta VARCHAR(30) CHECK (tipo_conta IN ("cliente", "operador")),
    plano VARCHAR(15) CHECK (plano IN ("padrao", "vip")),
    desconto_percentual DECIMAL (5,2)
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Cartoes_rfid (
    cartao_rfid_uid VARCHAR(100) PRIMARY KEY,
    status_cartao_rfid VARCHAR(9) CHECK (status_cartao_rfid IN ("em_uso", "estoque", "bloqueado")),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Carregadores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_serie VARCHAR (100) NOT NULL,
    modelo VARCHAR (100) NOT NULL,
    localizacao VARCHAR(255) NOT NULL,  
    potencia_maxima DECIMAL (10,2) DEFAULT NULL,
    endereco_ip VARCHAR(50) DEFAULT NULL,
    porta_modbus VARCHAR (15) DEFAULT NULL (10),
    status_modbus VARCHAR(25) CHECK (status_modbus IN ("ocioso", "aguardando_inicio_sessao", "em_uso", "pagamento_pendente", "erro")),
    potencia_atual DECIMAL (10,2),
    instalado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Sessoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carregador_id INT,
    cartao_rfid_uid VARCHAR(100),
    usuario_id INT,
    inicio_recarga DATETIME NOT NULL,
    fim_recarga DATETIME,
    duracao_minutos INT,
    potencia_media DECIMAL (10, 2),
    energia_kwh DECIMAL (10, 3),
    tarifa_aplicada DECIMAL (10, 4),
    custo_total DECIMAL (10,2) DEFAULT NULL,
    sessao_status VARCHAR (30) CHECK(sessao_status IN ("carregando", "encerrada", "cancelada", "pagamento_pendente")),
    modo_carga VARCHAR (30) CHECK (modo_carga IN ("rapido", "FV", "FV_baterias")),
    criada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizada_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (carregador_id) REFERENCES Carregadores(id), 
    FOREIGN KEY (cartao_rfid_uid) REFERENCES Cartoes_rfid (cartao_rfid_uid),
    FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) 
);

CREATE TABLE Faturas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sessao_id INT,
    usuario_id INT,
    valor_total DECIMAL (10,2),
    desconto_aplicado DECIMAL (10,2),
    status_pagamento VARCHAR (30),
    metodo_pagamento VARCHAR (30),
    transacao_externa_id VARCHAR (120),
    data_emissao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_pagamento DATETIME DEFAULT NULL,

    FOREIGN KEY (sessao_id) REFERENCES Sessoes (id),
    FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
);

CREATE TABLE Logs_Modbus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carregador_id INT, 
    endereco_registrador VARCHAR (100) NOT NULL,
    valor_bruto VARCHAR (100),
    valor_convertido VARCHAR (100),
    sucesso BOOLEAN,
    erro VARCHAR (300),
    gerado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (carregador_id) REFERENCES Carregadores (id)
);
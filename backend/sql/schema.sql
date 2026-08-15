CREATE TABLE Usuarios(
    id AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR (250) NOT NULL,
    email VARCHAR (150) NOT NULL,
    senha_hash VARCHAR (255) NOT NULL, 
    tipo_conta VARCHAR(30) CHECK (tipo_conta IN ("cliente", "operador")),
    plano VARCHAR(15),
    criado_em DATETIME NOT NULL,
)
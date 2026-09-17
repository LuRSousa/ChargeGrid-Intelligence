require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

/*
 * =============================================================================
 * M6 — Configuração central do Modbus
 * =============================================================================
 * Este arquivo é o ÚNICO lugar do módulo onde ficam:
 *   - os endereços dos registradores;
 *   - o significado dos valores lidos;
 *   - os parâmetros de conexão.
 *
 * FONTE: "Mapa MODBUS_HCA G2.pdf" (交流充电桩二代Modbus协议), GoodWe, v1.0.15.
 * Tudo marcado [PDF] veio literalmente desse documento.
 * O que o PDF não define está marcado [A CONFIRMAR] e é configurável por .env.
 * =============================================================================
 */

//Lê uma variável de ambiente com valor padrão
function env(nome, padrao) {
    const valor = process.env[nome];
    return valor === undefined || valor === '' ? padrao : valor;
}

//Lê uma variável de ambiente numérica com valor padrão
function envNumero(nome, padrao) {
    const valor = Number(env(nome, padrao));
    return Number.isFinite(valor) ? valor : Number(padrao);
}

//Lê uma variável de ambiente booleana com valor padrão
function envBooleano(nome, padrao) {
    return String(env(nome, padrao)).toLowerCase() === 'true';
}

/* -----------------------------------------------------------------------------
 * 1. ENDEREÇOS DOS REGISTRADORES — [PDF]
 *
 * Linhas exatas do documento:
 *   10015  Charging power            充电功率      RO  U16  1   SF 10  KW
 *   10016  Charging Capacity         本次充电电量  RO  U16  1   SF 10  KWH
 *   10017  Charging Station Status   充电桩状态    RO  U16  1   N/A    N/A
 *   10500  Charging card number      充电卡号      RO  STR  7   N/A    N/A
 * ---------------------------------------------------------------------------*/
const REGISTRADORES = {
    POTENCIA: 10015,            //[PDF] Charging power, kW
    ENERGIA: 10016,             //[PDF] Charging Capacity — energia DESTA recarga, kWh
    STATUS_CARREGADOR: 10017,   //[PDF] Charging Station Status
    RFID_INICIO: 10500          //[PDF] Charging card number, STR de 7 registradores
};

/*
 * [PDF] O cartão ocupa 7 registradores (tipo STR, #Size 7).
 * Nota do documento: "卡号UID固定14个字节" / "ASSIC code, not enough length fill '\0'"
 * => UID de 14 bytes fixos, em ASCII, preenchido com NUL quando menor.
 */
const RFID_QUANTIDADE = envNumero('MODBUS_RFID_REGISTRADORES', 7);

/*
 * A leitura completa exige DOIS pedidos Modbus:
 *
 *   Bloco 1: 10015, 10016, 10017        (contíguos — potência, energia, status)
 *   Bloco 2: 10500 .. 10506             (contíguos — cartão em ASCII)
 *
 * Não dá para juntar tudo num pedido só: de 10015 a 10506 são 492 registradores,
 * e o limite por pedido é 125 (norma Modbus) ou 127 (limite físico do campo
 * "byte count" da resposta, que tem 1 byte: 127 x 2 = 254 bytes).
 */
const BLOCO_MEDIDAS = {
    inicio: REGISTRADORES.POTENCIA,
    quantidade: 3
};

const BLOCO_RFID = {
    inicio: REGISTRADORES.RFID_INICIO,
    quantidade: RFID_QUANTIDADE
};

//Todos os endereços lidos, em ordem crescente (usado no fallback individual)
const ENDERECOS = [
    REGISTRADORES.POTENCIA,
    REGISTRADORES.ENERGIA,
    REGISTRADORES.STATUS_CARREGADOR
];

for (let i = 0; i < RFID_QUANTIDADE; i++) {
    ENDERECOS.push(REGISTRADORES.RFID_INICIO + i);
}

/* -----------------------------------------------------------------------------
 * 2. STATUS DO CARREGADOR — registrador 10017
 *
 * [PDF] Os 11 códigos abaixo e suas descrições vêm literalmente do documento.
 *
 * [INTERPRETAÇÃO DO PROJETO] A coluna `projeto` NÃO está no PDF. O HCA G2 tem 11
 * estados; a tabela Carregadores.status_modbus (sql/schema.sql) aceita só 5:
 * ocioso | aguardando_inicio_sessao | em_uso | pagamento_pendente | erro.
 * A correspondência abaixo é decisão nossa, e está isolada aqui para ser revista
 * sem tocar em nenhum outro arquivo.
 * ---------------------------------------------------------------------------*/
const STATUS_HCA = {
    0:  { chave: 'ocioso_sem_conector',    descricao: 'Idle (no connector plugged)',        projeto: 'ocioso' },
    1:  { chave: 'ocioso_conector_ligado', descricao: 'Idle (connector plugged)',           projeto: 'aguardando_inicio_sessao' },
    2:  { chave: 'handshake',              descricao: 'Handshaking with vehicle',           projeto: 'aguardando_inicio_sessao' },
    3:  { chave: 'carregando',             descricao: 'Charging in progress',               projeto: 'em_uso' },
    4:  { chave: 'carga_concluida',        descricao: 'Charging completed',                 projeto: 'pagamento_pendente' },
    5:  { chave: 'alarme',                 descricao: 'Abnormal alarm',                     projeto: 'erro' },
    6:  { chave: 'inicio_agendado',        descricao: 'Scheduled start',                    projeto: 'aguardando_inicio_sessao' },
    7:  { chave: 'manutencao',             descricao: 'Maintenance',                        projeto: 'erro' },
    8:  { chave: 'falha_ao_iniciar',       descricao: 'Start failed',                       projeto: 'erro' },
    9:  { chave: 'atualizando',            descricao: 'System upgrade in progress',         projeto: 'erro' },
    10: { chave: 'carga_interrompida',     descricao: 'Charging interrupted (insufficient PV/battery power)', projeto: 'erro' }
};

//Código numérico -> estado do projeto (o que vai para Carregadores.status_modbus)
const MAPA_STATUS = Object.entries(STATUS_HCA).reduce((acc, [codigo, info]) => {
    acc[Number(codigo)] = info.projeto;
    return acc;
}, {});

//Nome do estado do equipamento -> código numérico, usado pelo simulador
const MAPA_STATUS_INVERSO = Object.entries(STATUS_HCA).reduce((acc, [codigo, info]) => {
    acc[info.chave] = Number(codigo);
    return acc;
}, {});

/* -----------------------------------------------------------------------------
 * 3. INTERPRETAÇÃO DOS VALORES
 * ---------------------------------------------------------------------------*/

/*
 * [PDF] Cartão como texto ASCII no bloco 10500+.
 *
 * Cada registrador de 16 bits carrega 2 caracteres. 7 registradores = 14 bytes,
 * exatamente o tamanho fixo que o documento define para o UID.
 *
 * [PDF] A ordem dos bytes é o caractere mais significativo primeiro. Confirmado
 * pelo registrador 10592 (Safety version, STR de 2): o documento diz que a versão
 * "1.0.13" é transmitida como 0x31, 0x30, 0x31, 0x33 — ou seja, o primeiro
 * caractere ocupa o byte alto do primeiro registrador.
 */
const RFID = {
    ordem_bytes: env('MODBUS_RFID_BYTE_ORDER', 'alto_baixo'), //'alto_baixo' ou 'baixo_alto'
    maiusculo: envBooleano('MODBUS_RFID_MAIUSCULO', 'true'),
    //Descarta o preenchimento NUL e espaços das pontas
    limpar: envBooleano('MODBUS_RFID_LIMPAR', 'true')
};

/*
 * [PDF] Fator de escala (coluna #SF) igual a 10 para os dois registradores:
 *
 *   10015  Charging power     SF 10  KW    ->  740 significa 74,0 kW
 *   10016  Charging Capacity  SF 10  KWH   ->  125 significa 12,5 kWh
 */
const ESCALA_POTENCIA = envNumero('MODBUS_ESCALA_POTENCIA', 10);
const ESCALA_ENERGIA = envNumero('MODBUS_ESCALA_ENERGIA', 10);

/*
 * [PDF] 10015 é potência e 10016 é energia — não há ambiguidade no documento.
 * O flag existe só como válvula de escape caso o firmware do equipamento em campo
 * divirja do PDF. Em condições normais deve ficar em false.
 */
const INVERTER_MEDIDAS = envBooleano('MODBUS_INVERTER_MEDIDAS', 'false');

/* -----------------------------------------------------------------------------
 * 4. CONEXÃO
 * ---------------------------------------------------------------------------*/

const config = {
    //Endereço padrão. Cada carregador pode sobrescrever via endereco_ip / porta_modbus
    host: env('MODBUS_HOST', '127.0.0.1'),
    porta: envNumero('MODBUS_PORT', 5020),
    unitId: envNumero('MODBUS_UNIT_ID', 1),
    timeout: envNumero('MODBUS_TIMEOUT', 3000),

    /*
     * [A CONFIRMAR] Função Modbus e deslocamento de endereço.
     *
     * O PDF documenta os tipos de dado, os códigos de exceção e o formato serial
     * (9600 8N1), mas NÃO diz se os registradores são holding (FC3) ou input
     * (FC4), nem se 10015/10500 já são endereços de fio. O changelog da v1.0.04
     * menciona "补充功能码" (função adicionada), mas a seção não consta do arquivo.
     *
     * Como todos os nossos registradores são RO, input (FC4) é plausível; mas a
     * maioria dos equipamentos GoodWe expõe tudo como holding. Mantido
     * configurável até alguém testar contra o equipamento.
     */
    funcao: env('MODBUS_FUNCTION', 'holding'),           //'holding' ou 'input'
    offset: envNumero('MODBUS_OFFSET', 0),               //Somado ao endereço antes de ler
    leituraEmBloco: envBooleano('MODBUS_BLOCO', 'true'), //Lê cada bloco num pedido só

    logConsole: envBooleano('MODBUS_LOG_CONSOLE', 'true')
};

module.exports = {
    REGISTRADORES,
    RFID_QUANTIDADE,
    ENDERECOS,
    BLOCO_MEDIDAS,
    BLOCO_RFID,
    STATUS_HCA,
    MAPA_STATUS,
    MAPA_STATUS_INVERSO,
    RFID,
    ESCALA_POTENCIA,
    ESCALA_ENERGIA,
    INVERTER_MEDIDAS,
    config
};

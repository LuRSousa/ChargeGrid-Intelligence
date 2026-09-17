const ModbusRTU = require('modbus-serial');

const {
    REGISTRADORES,
    RFID_QUANTIDADE,
    ENDERECOS,
    BLOCO_MEDIDAS,
    BLOCO_RFID,
    STATUS_HCA,
    MAPA_STATUS,
    RFID,
    ESCALA_POTENCIA,
    ESCALA_ENERGIA,
    INVERTER_MEDIDAS,
    config
} = require('../config/modbusConfig');

/*
 * =============================================================================
 * M6 — Cliente Modbus TCP
 * =============================================================================
 * Camada única de comunicação. O restante do sistema NUNCA fala Modbus direto:
 *
 *      aplicação -> modbusClient -> Modbus TCP -> carregador
 *
 * O carregador do outro lado pode ser o simulador (src/services/modbusSimulator.js)
 * ou o HCA G2 / ESP32 real. O cliente NÃO sabe a diferença, e é essa a razão de
 * o simulador falar Modbus de verdade em vez de responder em memória: o mesmo
 * caminho de código é exercitado no desenvolvimento e em campo.
 *
 * Trocar simulador por hardware = apontar endereco_ip / porta_modbus para o
 * equipamento. Nenhuma linha deste arquivo muda.
 *
 * Responsabilidades:
 *   - abrir, reaproveitar e descartar conexões TCP;
 *   - ler os registradores em dois blocos, numa função centralizada;
 *   - traduzir valores brutos para o vocabulário do projeto;
 *   - nunca deixar erro de comunicação escapar sem contexto.
 *
 * O que este arquivo NÃO faz: regra de negócio, sessão, banco de dados.
 * =============================================================================
 */

const PREFIXO = '[MODBUS]';

//Log padronizado do módulo, silenciável por MODBUS_LOG_CONSOLE=false
function log(mensagem, ...extra) {
    if (config.logConsole) console.log(`${PREFIXO} ${mensagem}`, ...extra);
}

//Log de erro (sempre exibido — falha de comunicação precisa aparecer)
function logErro(mensagem, ...extra) {
    console.error(`${PREFIXO} ${mensagem}`, ...extra);
}

/*
 * Descreve um erro de forma legível.
 * Erros de rede costumam ter message vazia e guardar o motivo em `code`; usar só
 * erro.message produziria log em branco justamente quando ele mais importa.
 * Retorna {string}
 */
function descreverErro(erro) {
    if (!erro) return 'erro desconhecido';

    const partes = [];

    if (erro.message) partes.push(erro.message);
    if (erro.code) partes.push(`code=${erro.code}`);
    if (erro.modbusCode !== undefined) partes.push(`modbusCode=${erro.modbusCode}`);

    if (partes.length === 0) partes.push(erro.name || String(erro));

    return partes.join(' | ');
}

/* =============================================================================
 * INTERPRETAÇÃO — valores brutos para o vocabulário do projeto
 * ===========================================================================*/

/*
 * Um caractere e considerado preenchimento (nao faz parte do UID) quando esta
 * fora da faixa imprimivel do ASCII: codigos 0x00-0x1F (nulos e controles) e
 * 0x7F (DEL). Comparacao numerica em vez de expressao regular, para que o
 * arquivo nao precise conter nenhum caractere de controle literal.
 * Retorna {boolean}
 */
function ehImprimivel(codigo) {
    return codigo > 0x1F && codigo !== 0x7F;
}

/*
 * Decodifica o identificador do cartão RFID a partir dos registradores ASCII.
 *
 * Cada registrador de 16 bits carrega DOIS caracteres: um no byte alto e outro
 * no byte baixo. Sete registradores => até 14 caracteres.
 *
 *   registrador 0x4142  ->  'A' (0x41) + 'B' (0x42)
 *
 * A ordem dos bytes é configurável (MODBUS_RFID_BYTE_ORDER) porque a convenção
 * de string do Modbus é byte alto primeiro, mas nem todo fabricante segue.
 *
 * Caracteres não imprimíveis (nulos e controles) e espaços das pontas são
 * descartados: são preenchimento, não fazem parte do UID.
 *
 * Retorna {string|null} UID, ou null quando não há cartão apresentado
 */
function interpretarRFID(valores) {
    if (!Array.isArray(valores) || valores.length === 0) return null;

    let texto = '';

    for (const valor of valores) {
        const numero = Number(valor) || 0;

        const byteAlto = (numero >> 8) & 0xFF;
        const byteBaixo = numero & 0xFF;

        texto += RFID.ordem_bytes === 'baixo_alto'
            ? String.fromCharCode(byteBaixo, byteAlto)
            : String.fromCharCode(byteAlto, byteBaixo);
    }

    if (RFID.limpar) {
        texto = texto
            .split('')
            .filter((c) => ehImprimivel(c.charCodeAt(0)))
            .join('')
            .trim();
    }

    //Registradores zerados (ou só preenchimento) = nenhum cartão apresentado
    if (texto.length === 0) return null;

    return RFID.maiusculo ? texto.toUpperCase() : texto;
}

/*
 * Traduz o código do registrador 10017 para Carregadores.status_modbus.
 *
 * O HCA G2 tem 11 estados e a tabela do projeto aceita 5, então esta é uma
 * traducao com perda: 'Maintenance', 'Start failed' e 'System upgrade' viram
 * todos 'erro'. O código bruto e o estado original do equipamento continuam
 * disponíveis na leitura (status_codigo e status_hca) para quem precisar deles.
 * Retorna {string|null} null quando o código não está mapeado (não inventamos)
 */
function interpretarStatus(codigo) {
    return MAPA_STATUS[codigo] !== undefined ? MAPA_STATUS[codigo] : null;
}

/*
 * Devolve o estado do equipamento como o próprio PDF da GoodWe o define, sem a
 * perda imposta pela conversão para o vocabulário do projeto.
 * Retorna {Object} { chave, descricao } — vazio quando o código é desconhecido
 */
function interpretarStatusHCA(codigo) {
    const info = STATUS_HCA[codigo];

    return {
        chave: info ? info.chave : null,
        descricao: info ? info.descricao : null
    };
}

//Aplica a escala a um valor bruto, preservando null quando não houve leitura
//Retorna {number|null}
function aplicarEscala(bruto, escala) {
    if (bruto === undefined || bruto === null) return null;
    return Number((Number(bruto) / escala).toFixed(2));
}

/*
 * Monta a leitura normalizada a partir dos valores brutos.
 * Os endereços originais continuam disponíveis em `brutos`, para depuração e
 * para uma futura reinterpretação dos registradores sem perda de informação.
 * Retorna {Object} Leitura normalizada
 */
function interpretar(carregadorId, brutos) {
    const statusCodigo = brutos[REGISTRADORES.STATUS_CARREGADOR];

    /*
     * INVERTER_MEDIDAS existe porque a revisão do líder disse "potência e
     * energia" sem apontar qual endereço é qual. Trocar a leitura é uma variável
     * de ambiente, não uma alteração de código.
     */
    const brutoPotencia = INVERTER_MEDIDAS
        ? brutos[REGISTRADORES.ENERGIA]
        : brutos[REGISTRADORES.POTENCIA];

    const brutoEnergia = INVERTER_MEDIDAS
        ? brutos[REGISTRADORES.POTENCIA]
        : brutos[REGISTRADORES.ENERGIA];

    //Os registradores do RFID, na ordem em que foram lidos
    const registradoresRFID = [];
    for (let i = 0; i < RFID_QUANTIDADE; i++) {
        registradoresRFID.push(brutos[REGISTRADORES.RFID_INICIO + i]);
    }

    const status = interpretarStatus(statusCodigo);
    const hca = interpretarStatusHCA(statusCodigo);

    if (status === null) {
        logErro(
            `Codigo de status ${statusCodigo} nao mapeado (registrador ${REGISTRADORES.STATUS_CARREGADOR}). ` +
            `O PDF da GoodWe define os codigos 0 a 10; ajuste STATUS_HCA em src/config/modbusConfig.js.`
        );
    }

    return {
        carregador_id: carregadorId,
        timestamp: new Date(),
        ok: true,

        //Valores prontos para uso pela aplicação
        status,                                    //estado do projeto, ou null
        status_codigo: statusCodigo,               //código bruto do registrador 10017
        status_hca: hca.chave,                     //estado do equipamento, sem perda
        status_hca_descricao: hca.descricao,       //descrição em inglês, como no PDF
        rfid_uid: interpretarRFID(registradoresRFID),
        potencia_kw: aplicarEscala(brutoPotencia, ESCALA_POTENCIA),
        energia_kwh: aplicarEscala(brutoEnergia, ESCALA_ENERGIA),

        //Valores brutos, sempre preservados
        potencia_bruta: brutoPotencia,
        energia_bruta: brutoEnergia,
        rfid_registradores: registradoresRFID,
        brutos: { ...brutos }
    };
}

/* =============================================================================
 * CONEXÕES
 * ===========================================================================*/

/*
 * As conexões ficam em cache por "host:porta:unitId", uma por carregador físico.
 * Reabrir socket a cada leitura é caro e desnecessário — equipamentos industriais
 * costumam limitar o número de conexões simultâneas.
 */
const conexoes = new Map();

/*
 * Descobre host/porta/unitId do carregador, com os valores do .env como padrão.
 *
 * Os nomes endereco_ip e porta_modbus vêm da tabela Carregadores do projeto
 * principal (sql/schema.sql), para que um registro do banco possa ser passado
 * direto para este módulo.
 * Retorna {Object} { host, porta, unitId, chave }
 */
function enderecoDoCarregador(carregador) {
    const host = carregador.endereco_ip || config.host;
    const porta = Number(carregador.porta_modbus) || config.porta;
    const unitId = Number(carregador.unit_id) || config.unitId;

    return { host, porta, unitId, chave: `${host}:${porta}:${unitId}` };
}

//Abre (ou reaproveita) a conexão TCP com um carregador
//Retorna {Promise<Object>} Cliente ModbusRTU conectado
async function obterConexao(carregador) {
    const { host, porta, unitId, chave } = enderecoDoCarregador(carregador);
    const existente = conexoes.get(chave);

    if (existente && existente.isOpen) {
        existente.setID(unitId);
        return existente;
    }

    const cliente = new ModbusRTU();
    cliente.setTimeout(config.timeout);

    log(`Conectando em ${host}:${porta} (unitId ${unitId})...`);
    await cliente.connectTCP(host, { port: porta });
    cliente.setID(unitId);

    conexoes.set(chave, cliente);
    log(`Conectado em ${host}:${porta}`);

    return cliente;
}

//Fecha e descarta a conexão de um carregador, forçando reconexão na próxima leitura
async function descartarConexao(carregador) {
    const { chave } = enderecoDoCarregador(carregador);
    const cliente = conexoes.get(chave);

    if (!cliente) return;

    conexoes.delete(chave);

    try {
        await new Promise((resolve) => cliente.close(resolve));
    } catch (erro) {
        logErro(`Erro ao fechar conexao ${chave}: ${descreverErro(erro)}`);
    }
}

/* =============================================================================
 * LEITURA
 * ===========================================================================*/

/*
 * Executa a leitura de um bloco de registradores usando a função configurada.
 *
 * O endereço passado à biblioteca vai direto para o pacote, sem conversão; o
 * config.offset existe para compensar a diferença entre endereço de documentação
 * e endereço de fio.
 * Retorna {Promise<Array<number>>} Valores lidos
 */
async function lerBloco(cliente, enderecoInicial, quantidade) {
    const endereco = enderecoInicial + config.offset;

    const resposta = config.funcao === 'input'
        ? await cliente.readInputRegisters(endereco, quantidade)
        : await cliente.readHoldingRegisters(endereco, quantidade);

    return resposta.data;
}

/*
 * Lê os registradores de um carregador.
 *
 * São necessários DOIS pedidos:
 *   Bloco 1: 10015-10017 (potência, energia, status)
 *   Bloco 2: 10500-10506 (RFID em ASCII)
 *
 * Os dois grupos estão a 492 registradores de distância, muito além do limite de
 * 125/127 por pedido. Se o equipamento recusar a leitura em bloco, caímos
 * automaticamente para leituras individuais.
 * Retorna {Promise<Object>} { endereco: valor }
 */
async function lerBrutos(carregador) {
    const cliente = await obterConexao(carregador);
    const brutos = {};

    if (config.leituraEmBloco) {
        try {
            //Bloco 1 — medidas e status
            const medidas = await lerBloco(cliente, BLOCO_MEDIDAS.inicio, BLOCO_MEDIDAS.quantidade);

            for (let i = 0; i < BLOCO_MEDIDAS.quantidade; i++) {
                brutos[BLOCO_MEDIDAS.inicio + i] = medidas[i];
            }

            //Bloco 2 — RFID em ASCII
            const rfid = await lerBloco(cliente, BLOCO_RFID.inicio, BLOCO_RFID.quantidade);

            for (let i = 0; i < BLOCO_RFID.quantidade; i++) {
                brutos[BLOCO_RFID.inicio + i] = rfid[i];
            }

            return brutos;
        } catch (erro) {
            log(`Leitura em bloco falhou (${descreverErro(erro)}); tentando registrador a registrador.`);
        }
    }

    for (const endereco of ENDERECOS) {
        const dados = await lerBloco(cliente, endereco, 1);
        brutos[endereco] = dados[0];
    }

    return brutos;
}

/* =============================================================================
 * INTERFACE PÚBLICA
 * ===========================================================================*/

class ModbusClient {

    /*
     * FUNÇÃO CENTRALIZADA DE LEITURA.
     * É o único ponto do sistema que lê registradores Modbus.
     *
     * Nunca lança exceção: em caso de falha devolve uma leitura com ok=false e o
     * erro descrito, para que quem chamou decida o que fazer sem derrubar o
     * processo. Uma leitura com ok=false NÃO deve ser usada para atualizar estado.
     *
     * carregador {Object} { id, endereco_ip, porta_modbus, unit_id }
     *                     endereco_ip/porta_modbus/unit_id são opcionais;
     *                     na ausência valem os padrões do .env.
     * Retorna {Promise<Object>} Leitura normalizada
     */
    async lerRegistradores(carregador) {
        const carregadorId = carregador && carregador.id;

        try {
            if (!carregadorId) {
                throw new Error('Carregador sem id: nao e possivel ler os registradores');
            }

            const brutos = await lerBrutos(carregador);
            const leitura = interpretar(carregadorId, brutos);

            log(
                `Leitura realizada | carregador ${carregadorId} | ` +
                `${REGISTRADORES.STATUS_CARREGADOR}=${leitura.status_codigo} ` +
                `(${leitura.status_hca} -> ${leitura.status}) | ` +
                `potencia=${leitura.potencia_bruta} (${leitura.potencia_kw}) | ` +
                `energia=${leitura.energia_bruta} (${leitura.energia_kwh}) | ` +
                `rfid=${leitura.rfid_uid === null ? '-' : leitura.rfid_uid}`
            );

            return leitura;
        } catch (erro) {
            logErro(`Erro de comunicacao | carregador ${carregadorId} | ${descreverErro(erro)}`);

            //A conexão pode ter ficado inutilizável: descarta para reconectar na próxima
            if (carregadorId) await descartarConexao(carregador);

            return {
                carregador_id: carregadorId,
                timestamp: new Date(),
                ok: false,
                erro: descreverErro(erro),
                status: null,
                status_codigo: null,
                status_hca: null,
                status_hca_descricao: null,
                rfid_uid: null,
                potencia_kw: null,
                energia_kwh: null,
                potencia_bruta: null,
                energia_bruta: null,
                rfid_registradores: [],
                brutos: {}
            };
        }
    }

    //Encerra todas as conexões abertas (usar ao finalizar o processo)
    async desconectar() {
        const clientes = Array.from(conexoes.values());
        conexoes.clear();

        for (const cliente of clientes) {
            try {
                await new Promise((resolve) => cliente.close(resolve));
            } catch (erro) {
                logErro(`Erro ao encerrar conexao: ${descreverErro(erro)}`);
            }
        }

        if (clientes.length > 0) log(`${clientes.length} conexao(oes) encerrada(s).`);
    }
}

const cliente = new ModbusClient();

module.exports = cliente;
module.exports.ModbusClient = ModbusClient;
module.exports.interpretar = interpretar;
module.exports.interpretarRFID = interpretarRFID;
module.exports.interpretarStatus = interpretarStatus;
module.exports.interpretarStatusHCA = interpretarStatusHCA;
module.exports.descreverErro = descreverErro;

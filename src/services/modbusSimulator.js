const ModbusRTU = require('modbus-serial');

const {
    REGISTRADORES,
    RFID_QUANTIDADE,
    ENDERECOS,
    STATUS_HCA,
    MAPA_STATUS,
    MAPA_STATUS_INVERSO,
    RFID,
    ESCALA_POTENCIA,
    ESCALA_ENERGIA,
    config
} = require('../config/modbusConfig');

/*
 * =============================================================================
 * M6 — Simulador de carregador (servidor Modbus TCP real)
 * =============================================================================
 * Substitui o HCA G2 durante o desenvolvimento.
 *
 * Este simulador NÃO responde em memória: ele sobe um servidor Modbus TCP de
 * verdade. O modbusClient conversa com ele exatamente como conversaria com o
 * equipamento — socket TCP, cabeçalho MBAP, function code, frame de resposta.
 *
 * Essa decisão é deliberada. Um simulador que responde por chamada de função
 * deixa o caminho TCP (justamente o que vai para o hardware) nunca ser
 * executado, e o erro só aparece no dia da integração.
 *
 * O mapa de registradores segue src/config/modbusConfig.js:
 *   10015 potência | 10016 energia | 10017 status | 10500-10506 RFID em ASCII
 *
 * Os valores NÃO são aleatórios: quem controla o simulador é quem está testando.
 * É isso que permite validar o comportamento de forma previsível.
 * =============================================================================
 */

const PREFIXO = '[SIMULADOR]';
const VALOR_MAXIMO_REGISTRADOR = 0xFFFF; //Um registrador Modbus tem 16 bits

//Log padronizado do módulo, silenciável por MODBUS_LOG_CONSOLE=false
function log(mensagem, ...extra) {
    if (config.logConsole) console.log(`${PREFIXO} ${mensagem}`, ...extra);
}

//Log de erro (sempre exibido)
function logErro(mensagem, ...extra) {
    console.error(`${PREFIXO} ${mensagem}`, ...extra);
}

class ModbusSimulator {
    constructor() {
        //Map<carregador_id, { registradores: {endereco: valor}, falha: string|null }>
        this.dispositivos = new Map();
        this.servidor = null;
        this.endereco = null;
    }

    /* ---------------------------------------------------------------------
     * Banco de registradores
     * -------------------------------------------------------------------*/

    //Garante que existe um banco de registradores para o carregador
    //Retorna {Object} Dispositivo simulado
    obterDispositivo(carregadorId) {
        const chave = String(carregadorId);

        if (!this.dispositivos.has(chave)) {
            const registradores = {
                [REGISTRADORES.POTENCIA]: 0,
                [REGISTRADORES.ENERGIA]: 0,
                [REGISTRADORES.STATUS_CARREGADOR]: MAPA_STATUS_INVERSO.ocioso_sem_conector
            };

            //Bloco do RFID começa zerado = nenhum cartão apresentado
            for (let i = 0; i < RFID_QUANTIDADE; i++) {
                registradores[REGISTRADORES.RFID_INICIO + i] = 0;
            }

            this.dispositivos.set(chave, {
                carregador_id: carregadorId,
                registradores,
                falha: null
            });
        }

        return this.dispositivos.get(chave);
    }

    /*
     * Lê um registrador do carregador simulado.
     * Lança erro quando o endereço não existe, para que o servidor devolva uma
     * exceção Modbus em vez de inventar um valor.
     * Retorna {number} Valor bruto (0-65535)
     */
    lerRegistrador(carregadorId, endereco) {
        const dispositivo = this.obterDispositivo(carregadorId);

        if (dispositivo.falha) {
            throw new Error(dispositivo.falha);
        }

        const valor = dispositivo.registradores[endereco];

        if (valor === undefined) {
            throw new Error(`Registrador ${endereco} nao existe no carregador ${carregadorId}`);
        }

        return valor;
    }

    //Escreve um registrador do carregador simulado
    //Retorna {number} Valor gravado
    setRegistrador(carregadorId, endereco, valor) {
        const dispositivo = this.obterDispositivo(carregadorId);
        const numero = Number(valor);

        if (!Number.isInteger(numero) || numero < 0 || numero > VALOR_MAXIMO_REGISTRADOR) {
            throw new Error(
                `Valor invalido para o registrador ${endereco}: ${valor}. ` +
                `Um registrador Modbus aceita inteiros de 0 a ${VALOR_MAXIMO_REGISTRADOR}.`
            );
        }

        dispositivo.registradores[endereco] = numero;
        return numero;
    }

    /* ---------------------------------------------------------------------
     * Atalhos semânticos — escrevem usando o vocabulário do projeto.
     * Todos dependem apenas de src/config/modbusConfig.js
     * -------------------------------------------------------------------*/

    /*
     * Define o status usando o nome do estado DO EQUIPAMENTO (os 11 do PDF da
     * GoodWe), e não o estado do projeto. O simulador imita o HCA G2, então ele
     * fala o vocabulário do HCA G2 — quem traduz para o projeto é o modbusClient.
     * Valores validos: ver STATUS_HCA em src/config/modbusConfig.js
     * Retorna {number} Código numérico gravado
     */
    definirStatus(carregadorId, statusTexto) {
        const codigo = MAPA_STATUS_INVERSO[statusTexto];

        if (codigo === undefined) {
            throw new Error(
                `Status desconhecido: "${statusTexto}". ` +
                `Validos: ${Object.keys(MAPA_STATUS_INVERSO).join(', ')}`
            );
        }

        this.setRegistrador(carregadorId, REGISTRADORES.STATUS_CARREGADOR, codigo);
        return codigo;
    }

    /*
     * Grava o identificador do cartão RFID como TEXTO ASCII no bloco 10500+.
     *
     * É a operação inversa da leitura feita pelo modbusClient: cada registrador
     * recebe dois caracteres, um no byte alto e outro no byte baixo.
     *
     *   'A1'  ->  0x4131
     *
     * Passar null (ou string vazia) zera o bloco inteiro = nenhum cartão.
     * Retorna {Array<number>} Registradores gravados
     */
    definirRFID(carregadorId, uid) {
        const capacidade = RFID_QUANTIDADE * 2;
        let texto = uid === null || uid === undefined ? '' : String(uid).trim();

        if (texto.length > capacidade) {
            throw new Error(
                `UID "${texto}" tem ${texto.length} caracteres, mas o bloco RFID ` +
                `comporta no maximo ${capacidade} (${RFID_QUANTIDADE} registradores x 2).`
            );
        }

        /*
         * Completa com nulos até preencher o bloco, como faria o equipamento.
         * O caractere NUL é criado por código (String.fromCharCode) em vez de
         * escrito literalmente, para que este arquivo continue sendo texto puro.
         * A leitura descarta esse preenchimento, então ele não entra no UID.
         */
        const PREENCHIMENTO = String.fromCharCode(0);
        const preenchido = texto.padEnd(capacidade, PREENCHIMENTO);

        const gravados = [];

        for (let i = 0; i < RFID_QUANTIDADE; i++) {
            const primeiro = preenchido.charCodeAt(i * 2) & 0xFF;
            const segundo = preenchido.charCodeAt(i * 2 + 1) & 0xFF;

            //A ordem dos bytes acompanha a configuração usada na leitura
            const valor = RFID.ordem_bytes === 'baixo_alto'
                ? (segundo << 8) | primeiro
                : (primeiro << 8) | segundo;

            this.setRegistrador(carregadorId, REGISTRADORES.RFID_INICIO + i, valor);
            gravados.push(valor);
        }

        return gravados;
    }

    //Grava a potência instantânea, aplicando a escala configurada
    //Retorna {number} Valor bruto gravado
    definirPotencia(carregadorId, potencia) {
        const bruto = Math.round(Number(potencia) * ESCALA_POTENCIA);
        this.setRegistrador(carregadorId, REGISTRADORES.POTENCIA, bruto);
        return bruto;
    }

    //Grava a energia acumulada, aplicando a escala configurada
    //Retorna {number} Valor bruto gravado
    definirEnergia(carregadorId, energia) {
        const bruto = Math.round(Number(energia) * ESCALA_ENERGIA);
        this.setRegistrador(carregadorId, REGISTRADORES.ENERGIA, bruto);
        return bruto;
    }

    /*
     * Aplica um cenário completo ao carregador simulado.
     *
     * Cada cenário corresponde a um dos estados reais do HCA G2 (PDF da GoodWe):
     *
     *   ocioso            -> 0  Idle (no connector plugged)
     *   conector_ligado   -> 1  Idle (connector plugged) — cabo plugado, cartão lido
     *   handshake         -> 2  Handshaking with vehicle
     *   carregando        -> 3  Charging in progress
     *   carga_concluida   -> 4  Charging completed
     *   interrompido      -> 10 Charging interrupted (insufficient PV/battery power)
     *   erro              -> 5  Abnormal alarm
     *
     * Retorna {Object} Registradores resultantes
     */
    cenario(carregadorId, nome, opcoes = {}) {
        const { rfid = null, potencia = 0, energia = null } = opcoes;

        switch (nome) {
            case 'ocioso':
                this.definirStatus(carregadorId, 'ocioso_sem_conector');
                this.definirRFID(carregadorId, null);
                this.definirPotencia(carregadorId, 0);
                this.definirEnergia(carregadorId, 0);
                break;

            case 'conector_ligado':
                if (!rfid) throw new Error("O cenario 'conector_ligado' exige opcoes.rfid");
                this.definirStatus(carregadorId, 'ocioso_conector_ligado');
                this.definirRFID(carregadorId, rfid);
                this.definirPotencia(carregadorId, 0);
                this.definirEnergia(carregadorId, 0);
                break;

            case 'handshake':
                this.definirStatus(carregadorId, 'handshake');
                if (rfid) this.definirRFID(carregadorId, rfid);
                this.definirPotencia(carregadorId, 0);
                break;

            case 'carregando':
                this.definirStatus(carregadorId, 'carregando');
                if (rfid) this.definirRFID(carregadorId, rfid);
                this.definirPotencia(carregadorId, potencia || 7.4);
                if (energia !== null) this.definirEnergia(carregadorId, energia);
                break;

            case 'interrompido':
                //Estado 10: sem potência solar/bateria suficiente. O cartão continua lá.
                this.definirStatus(carregadorId, 'carga_interrompida');
                this.definirPotencia(carregadorId, 0);
                if (energia !== null) this.definirEnergia(carregadorId, energia);
                break;

            case 'carga_concluida':
                this.definirStatus(carregadorId, 'carga_concluida');
                this.definirPotencia(carregadorId, 0);
                //A energia acumulada NÃO é zerada: é o que será cobrado
                if (energia !== null) this.definirEnergia(carregadorId, energia);
                break;

            case 'sessao_finalizada':
                this.definirStatus(carregadorId, 'ocioso_sem_conector');
                this.definirRFID(carregadorId, null);
                this.definirPotencia(carregadorId, 0);
                this.definirEnergia(carregadorId, 0);
                break;

            case 'erro':
                this.definirStatus(carregadorId, 'alarme');
                this.definirPotencia(carregadorId, 0);
                break;

            default:
                throw new Error(`Cenario desconhecido: "${nome}"`);
        }

        return this.obterDispositivo(carregadorId).registradores;
    }

    //Faz o dispositivo recusar leituras, como um carregador offline
    simularFalha(carregadorId, mensagem = 'carregador indisponivel (simulado)') {
        this.obterDispositivo(carregadorId).falha = mensagem;
    }

    //Volta o dispositivo a responder normalmente
    limparFalha(carregadorId) {
        this.obterDispositivo(carregadorId).falha = null;
    }

    //Visão legível do dispositivo, com valores brutos e interpretados
    //Retorna {Object}
    estado(carregadorId) {
        const dispositivo = this.obterDispositivo(carregadorId);
        const registradores = dispositivo.registradores;
        const codigoStatus = registradores[REGISTRADORES.STATUS_CARREGADOR];

        return {
            carregador_id: dispositivo.carregador_id,
            falha: dispositivo.falha,
            brutos: { ...registradores },
            interpretado: {
                status: MAPA_STATUS[codigoStatus] || null,
                status_codigo: codigoStatus,
                status_hca: STATUS_HCA[codigoStatus] ? STATUS_HCA[codigoStatus].chave : null,
                potencia: registradores[REGISTRADORES.POTENCIA] / ESCALA_POTENCIA,
                energia: registradores[REGISTRADORES.ENERGIA] / ESCALA_ENERGIA
            }
        };
    }

    /* ---------------------------------------------------------------------
     * Servidor Modbus TCP
     * -------------------------------------------------------------------*/

    /*
     * Traduz o Unit ID da requisição para o id de carregador simulado.
     * Por padrão são o mesmo número, reproduzindo o comportamento real: o Unit ID
     * é o que distingue dispositivos atrás de um mesmo host/porta.
     * Retorna {number} Id do carregador
     */
    carregadorDoUnitId(unitId) {
        return unitId;
    }

    /*
     * Monta o "vector" exigido pelo ServerTCP: as funções que a biblioteca chama
     * quando chega uma requisição.
     *
     * Holding (FC3) e input (FC4) usam a mesma fonte, porque MODBUS_FUNCTION é
     * configurável e ainda não se sabe como o HCA G2 expõe os registradores.
     *
     * O config.offset é subtraído aqui: o cliente soma antes de perguntar, o
     * simulador desfaz para voltar ao endereço de documentação. Assim
     * MODBUS_OFFSET pode ser testado de ponta a ponta.
     * Retorna {Object} Vector do ServerTCP
     */
    montarVector() {
        const lerUm = (addr, unitID) => {
            const carregadorId = this.carregadorDoUnitId(unitID);
            const valor = this.lerRegistrador(carregadorId, addr - config.offset);

            log(`leitura | unitId ${unitID} | ${addr} = ${valor}`);
            return valor;
        };

        const lerVarios = (addr, length, unitID) => {
            const carregadorId = this.carregadorDoUnitId(unitID);
            const valores = [];

            for (let i = 0; i < length; i++) {
                valores.push(this.lerRegistrador(carregadorId, addr + i - config.offset));
            }

            log(`leitura em bloco | unitId ${unitID} | ${addr} x${length} = [${valores.join(', ')}]`);
            return valores;
        };

        return {
            getHoldingRegister: lerUm,
            getInputRegister: lerUm,
            getMultipleHoldingRegisters: lerVarios,
            getMultipleInputRegisters: lerVarios
        };
    }

    /*
     * Sobe o servidor Modbus TCP.
     * Os padrões vêm do modbusConfig, para que o simulador escute exatamente onde
     * o modbusClient tentaria conectar.
     *
     * opcoes.host         {string} padrão config.host
     * opcoes.porta        {number} padrão config.porta
     * opcoes.unitId       {number} padrão config.unitId
     * opcoes.carregadores {Array}  ids a pré-registrar
     *
     * Retorna {Promise<Object>} { host, porta, unitId }
     */
    iniciar(opcoes = {}) {
        if (this.servidor) return Promise.resolve(this.endereco);

        const host = opcoes.host || config.host;
        const porta = Number(opcoes.porta) || config.porta;
        const unitId = Number(opcoes.unitId) || config.unitId;
        const carregadores = opcoes.carregadores || [unitId];

        for (const carregadorId of carregadores) {
            this.obterDispositivo(carregadorId);
        }

        return new Promise((resolve, reject) => {
            let finalizado = false;

            try {
                this.servidor = new ModbusRTU.ServerTCP(this.montarVector(), {
                    host,
                    port: porta,
                    unitID: unitId,
                    debug: false
                });
            } catch (erro) {
                this.servidor = null;
                return reject(erro);
            }

            //Erro do próprio servidor (porta ocupada, host inválido)
            this.servidor.on('serverError', (erro) => {
                logErro(`Erro do servidor: ${erro && erro.message ? erro.message : erro}`);

                //A porta ocupada é o tropeço mais comum de quem roda pela primeira vez
                if (erro && erro.code === 'EADDRINUSE') {
                    logErro(
                        `A porta ${porta} ja esta em uso por outro programa. ` +
                        `Rode em outra porta com MODBUS_PORT=5099, ou descubra quem esta usando ` +
                        `com: netstat -ano | findstr ${porta}`
                    );
                }

                if (!finalizado) {
                    finalizado = true;
                    this.servidor = null;
                    reject(erro);
                }
            });

            //Erro de um cliente específico não derruba o simulador
            this.servidor.on('socketError', (erro) => {
                logErro(`Erro de socket: ${erro && erro.message ? erro.message : erro}`);
            });

            this.servidor.on('initialized', () => {
                if (finalizado) return;
                finalizado = true;

                this.endereco = { host, porta, unitId };

                log(`Ouvindo em ${host}:${porta} (unitId ${unitId}, offset ${config.offset})`);
                log(`Registradores expostos: ${ENDERECOS.join(', ')}`);

                resolve(this.endereco);
            });
        });
    }

    //Encerra o servidor e libera a porta
    //Retorna {Promise<void>}
    parar() {
        if (!this.servidor) return Promise.resolve();

        const servidor = this.servidor;
        this.servidor = null;
        this.endereco = null;

        return new Promise((resolve) => {
            try {
                servidor.close(() => {
                    log('Servidor encerrado.');
                    resolve();
                });
            } catch (erro) {
                logErro(`Erro ao encerrar: ${erro && erro.message ? erro.message : erro}`);
                resolve();
            }
        });
    }
}

//Instância única compartilhada pelo processo (o "parque" de carregadores simulados)
const simulador = new ModbusSimulator();

/* =============================================================================
 * EXECUÇÃO DIRETA — `npm run simulador`
 * ===========================================================================*/

if (require.main === module) {
    const carregadorId = Number(process.env.MODBUS_SIM_CARREGADOR) || config.unitId;

    simulador.cenario(carregadorId, 'carregando', {
        rfid: 'A1B2C3D4',
        potencia: 7.4,
        energia: 12.5
    });

    simulador
        .iniciar({ carregadores: [carregadorId] })
        .then(() => {
            console.log(`${PREFIXO} Pronto. Encerre com Ctrl+C.`);
            console.log(`${PREFIXO} Estado inicial:`, JSON.stringify(simulador.estado(carregadorId)));
        })
        .catch((erro) => {
            logErro(`Nao foi possivel iniciar: ${erro && erro.message ? erro.message : erro}`);
            process.exit(1);
        });

    const encerrar = async () => {
        await simulador.parar();
        process.exit(0);
    };

    process.on('SIGINT', encerrar);
    process.on('SIGTERM', encerrar);
}

module.exports = simulador;
module.exports.ModbusSimulator = ModbusSimulator;

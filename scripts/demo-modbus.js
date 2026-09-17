const simulador = require('../src/services/modbusSimulator');
const modbusClient = require('../src/services/modbusClient');
const {
    REGISTRADORES,
    RFID_QUANTIDADE,
    ESCALA_POTENCIA,
    ESCALA_ENERGIA,
    config
} = require('../src/config/modbusConfig');

/*
 * =============================================================================
 * M6 — Demonstração da comunicação Modbus TCP
 * =============================================================================
 * Sobe o simulador, conecta o cliente e percorre o ciclo de vida de uma recarga
 * usando os estados reais do HCA G2 (Mapa MODBUS_HCA G2.pdf, GoodWe).
 * Não usa banco de dados, não usa Express, não depende de hardware.
 *
 * Cada etapa altera os registradores do simulador e faz uma leitura real via
 * Modbus TCP, mostrando o valor bruto e o valor interpretado.
 *
 * Uso: npm run demo
 * =============================================================================
 */

const CARREGADOR = {
    id: 1,
    endereco_ip: config.host,
    porta_modbus: config.porta,
    unit_id: config.unitId
};

//UID de exemplo. O PDF define 14 bytes fixos, preenchidos com NUL quando menor.
const CARTAO = 'A1B2C3D4';

//Pausa entre etapas, só para a saída ficar legível na apresentação
function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

//Formata os registradores do cartão em hexadecimal, para conferir o ASCII
//Retorna {string}
function rfidEmHex(valores) {
    return valores
        .map((v) => '0x' + Number(v || 0).toString(16).toUpperCase().padStart(4, '0'))
        .join(' ');
}

//Imprime o resultado de uma leitura já normalizada pelo cliente
function mostrarLeitura(titulo, leitura) {
    console.log('');
    console.log(`--- ${titulo} ---`);

    if (!leitura.ok) {
        console.log(`  FALHA DE COMUNICACAO: ${leitura.erro}`);
        return;
    }

    const ultimoRFID = REGISTRADORES.RFID_INICIO + RFID_QUANTIDADE - 1;

    console.log('  Brutos (o que o Modbus entregou):');
    console.log(`    ${REGISTRADORES.POTENCIA} potencia = ${leitura.potencia_bruta}`);
    console.log(`    ${REGISTRADORES.ENERGIA} energia  = ${leitura.energia_bruta}`);
    console.log(`    ${REGISTRADORES.STATUS_CARREGADOR} status   = ${leitura.status_codigo}`);
    console.log(`    ${REGISTRADORES.RFID_INICIO}-${ultimoRFID} cartao = ${rfidEmHex(leitura.rfid_registradores)}`);
    console.log('  Interpretado:');
    console.log(`    equipamento : ${leitura.status_codigo} = ${leitura.status_hca_descricao}`);
    console.log(`    projeto     : ${leitura.status}`);
    console.log(`    cartao      : ${leitura.rfid_uid === null ? 'nenhum' : leitura.rfid_uid}`);
    console.log(`    potencia    : ${leitura.potencia_kw} kW`);
    console.log(`    energia     : ${leitura.energia_kwh} kWh`);
}

//Aplica um cenário no simulador e lê o resultado pelo cliente
async function etapa(titulo, cenario, opcoes) {
    simulador.cenario(CARREGADOR.id, cenario, opcoes);
    await esperar(150);

    const leitura = await modbusClient.lerRegistradores(CARREGADOR);
    mostrarLeitura(titulo, leitura);

    return leitura;
}

async function main() {
    console.log('=============================================');
    console.log(' M6 — Demonstracao Modbus TCP');
    console.log(' Mapa oficial: Mapa MODBUS_HCA G2.pdf (GoodWe)');
    console.log('=============================================');
    console.log(` ${REGISTRADORES.POTENCIA} potencia (SF ${ESCALA_POTENCIA}, kW) | ` +
                `${REGISTRADORES.ENERGIA} energia (SF ${ESCALA_ENERGIA}, kWh)`);
    console.log(` ${REGISTRADORES.STATUS_CARREGADOR} status | ` +
                `${REGISTRADORES.RFID_INICIO}+${RFID_QUANTIDADE} cartao ASCII (14 bytes)`);

    await simulador.iniciar({ carregadores: [CARREGADOR.id] });

    //0 — Idle (no connector plugged)
    await etapa('1. Ocioso, sem conector', 'ocioso');

    //1 — Idle (connector plugged): cabo plugado e cartao lido
    await etapa('2. Conector ligado, cartao lido', 'conector_ligado', { rfid: CARTAO });

    //2 — Handshaking with vehicle
    await etapa('3. Handshake com o veiculo', 'handshake', { rfid: CARTAO });

    //3 — Charging in progress
    await etapa('4. Carregando', 'carregando', { rfid: CARTAO, potencia: 7.4, energia: 0.5 });

    //3 — ainda carregando, potencia reduzida pelo rebalanceamento de demanda
    await etapa('5. Potencia reduzida', 'carregando', { rfid: CARTAO, potencia: 3.2, energia: 8.7 });

    //10 — Charging interrupted (insufficient PV/battery power)
    await etapa('6. Carga interrompida (sem PV)', 'interrompido', { energia: 9.1 });

    //4 — Charging completed: a energia acumulada e o que sera cobrado
    await etapa('7. Carga concluida', 'carga_concluida', { energia: 12.5 });

    //0 — de volta a ocioso
    await etapa('8. Sessao finalizada', 'sessao_finalizada');

    //Carregador offline — a leitura precisa falhar sem derrubar o processo
    console.log('');
    console.log('--- 9. Carregador offline (falha proposital) ---');
    simulador.simularFalha(CARREGADOR.id);
    const falha = await modbusClient.lerRegistradores(CARREGADOR);
    console.log(`  ok = ${falha.ok} (esperado: false)`);
    console.log(`  erro = ${falha.erro}`);
    simulador.limparFalha(CARREGADOR.id);

    //5 — Abnormal alarm
    await etapa('10. Alarme do equipamento', 'erro');

    //Volta ao normal
    await etapa('11. Comunicacao restabelecida', 'ocioso');

    console.log('');
    console.log('=============================================');
    console.log(' Demonstracao concluida.');
    console.log('=============================================');

    await modbusClient.desconectar();
    await simulador.parar();
}

main().catch(async (erro) => {
    console.error('ERRO NA DEMONSTRACAO:', erro && erro.message ? erro.message : erro);

    await modbusClient.desconectar();
    await simulador.parar();

    process.exit(1);
});

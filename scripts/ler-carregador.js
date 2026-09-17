const modbusClient = require('../src/services/modbusClient');
const { REGISTRADORES, RFID_QUANTIDADE, config } = require('../src/config/modbusConfig');

/*
 * =============================================================================
 * M6 — Leitura avulsa de um carregador
 * =============================================================================
 * Faz UMA leitura dos registradores e mostra o resultado. Não sobe simulador:
 * conecta no que estiver no endereço configurado.
 *
 * Serve tanto para o simulador quanto para o equipamento real — é a mesma
 * chamada, muda só o endereço.
 *
 * Uso:
 *   npm run simulador                  (num terminal)
 *   npm run ler                        (noutro terminal)
 *
 * Contra hardware real:
 *   MODBUS_HOST=192.168.0.50 MODBUS_PORT=502 npm run ler
 *
 * Argumentos opcionais: node scripts/ler-carregador.js <host> <porta> <unitId>
 * =============================================================================
 */

const [, , hostArg, portaArg, unitIdArg] = process.argv;

const carregador = {
    id: 1,
    endereco_ip: hostArg || config.host,
    porta_modbus: Number(portaArg) || config.porta,
    unit_id: Number(unitIdArg) || config.unitId
};

async function main() {
    console.log(
        `Lendo carregador em ${carregador.endereco_ip}:${carregador.porta_modbus} ` +
        `(unitId ${carregador.unit_id}, funcao ${config.funcao}, offset ${config.offset})...`
    );

    const leitura = await modbusClient.lerRegistradores(carregador);

    console.log('');

    if (!leitura.ok) {
        console.log('LEITURA FALHOU');
        console.log(`  erro: ${leitura.erro}`);
        console.log('');
        console.log('Causas mais comuns:');
        console.log('  ECONNREFUSED  -> ninguem escutando nesse host/porta (o simulador esta rodando?)');
        console.log('  ETIMEDOUT     -> endereco existe mas nao respondeu (rede/firewall)');
        console.log('  exception 2   -> endereco de registrador invalido (ajuste MODBUS_OFFSET)');
        console.log('  exception 1   -> funcao nao suportada (tente MODBUS_FUNCTION=input)');

        await modbusClient.desconectar();
        process.exit(1);
    }

    const ultimoRFID = REGISTRADORES.RFID_INICIO + RFID_QUANTIDADE - 1;

    console.log('=== LEITURA DO CARREGADOR ===');
    console.log(`${REGISTRADORES.POTENCIA} (potencia) : ${leitura.potencia_bruta}`);
    console.log(`${REGISTRADORES.ENERGIA} (energia)  : ${leitura.energia_bruta}`);
    console.log(`${REGISTRADORES.STATUS_CARREGADOR} (status)   : ${leitura.status_codigo}`);
    console.log(`${REGISTRADORES.RFID_INICIO}-${ultimoRFID} (rfid ascii) : [${leitura.rfid_registradores.join(', ')}]`);

    console.log('');
    console.log('=== INTERPRETADO ===');
    console.log(`equipamento : ${leitura.status_codigo} = ${leitura.status_hca_descricao || 'CODIGO DESCONHECIDO'}`);
    console.log(`projeto     : ${leitura.status === null ? 'DESCONHECIDO' : leitura.status}`);
    console.log(`cartao      : ${leitura.rfid_uid === null ? 'nenhum cartao' : leitura.rfid_uid}`);
    console.log(`potencia    : ${leitura.potencia_kw} kW`);
    console.log(`energia     : ${leitura.energia_kwh} kWh`);

    await modbusClient.desconectar();
}

main().catch(async (erro) => {
    console.error('ERRO:', erro && erro.message ? erro.message : erro);
    await modbusClient.desconectar();
    process.exit(1);
});

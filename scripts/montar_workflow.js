// Gera workflow/radar-vagas.json a partir do código testado em src/.
// Assim o JavaScript que roda nos nós "Code" do n8n é o mesmo dos testes.
// Uso: npm run workflow

const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const fonte = (arq) => fs.readFileSync(path.join(raiz, 'src', arq), 'utf8')
  .replace(/^module\.exports.*$/m, '')
  .trim();

const MODELO = 'gemini-3.6-flash';
// Plano gratuito do Gemini: 5 chamadas por minuto. 1 chamada a cada 13 s fica abaixo disso.
const INTERVALO_MS = 13000;

const codigoExtrair = `${fonte('extrair_vagas.js')}

// Junta as vagas de todos os e-mails, sem repetir link.
const vistos = new Set();
const saida = [];
for (const email of $input.all()) {
  for (const vaga of extrairVagas(email.json.text)) {
    if (vistos.has(vaga.link)) continue;
    vistos.add(vaga.link);
    saida.push({ json: { ...vaga, data_email: email.json.date || '' } });
  }
}
return saida;`;

const codigoPedido = `${fonte('classificar.js')}

const vaga = $('Extrair vagas').item.json;
const encerrada = vagaEncerrada($json);
if (encerrada) return { json: { vaga, encerrada: true, motivo: encerrada } };
const html = typeof $json.data === 'string' ? $json.data : '';
return { json: { vaga, encerrada: false, pedido: montarPedido(vaga, htmlParaTexto(html)) } };`;

// Linha da planilha: igual para vaga classificada pela IA e vaga encerrada.
const LINHA = `return {
  json: {
    link: vaga.link,
    titulo: vaga.titulo,
    empresa: vaga.empresa,
    local: vaga.local,
    faixa: r.faixa,
    nivel: r.nivel,
    remoto: r.remoto,
    motivo: r.motivo,
    confianca: r.confianca,
    confirmada_no_email: vaga.confirmada ? 'sim' : 'nao',
    data_email: vaga.data_email,
    classificado_em: new Date().toISOString(),
  },
};`;

const codigoLer = `${fonte('classificar.js')}

const { vaga } = $('Montar pedido').item.json;
const r = lerResposta($json);
${LINHA}`;

const codigoEncerrada = `const { vaga, motivo } = $json;
const r = { faixa: 'encerrada', nivel: '', remoto: '', motivo, confianca: 'alta' };
${LINHA}`;

const no = (nome, tipo, versao, posicao, parametros, extra = {}) => ({
  id: nome.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name: nome,
  type: tipo,
  typeVersion: versao,
  position: posicao,
  parameters: parametros,
  ...extra,
});

const nodes = [
  no('Executar manualmente', 'n8n-nodes-base.manualTrigger', 1, [0, 0], {}),
  no('Todo dia 8h30 e 14h30', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 200], {
    rule: { interval: [{ field: 'cronExpression', expression: '30 8,14 * * *' }] },
  }),
  no('Buscar e-mails de vagas', 'n8n-nodes-base.gmail', 2.1, [240, 100], {
    operation: 'getAll',
    limit: 10,
    simple: false,
    filters: { q: 'subject:"Vagas Estágio/Jr" newer_than:2d' },
    options: {},
  }),
  no('Extrair vagas', 'n8n-nodes-base.code', 2, [480, 100], { jsCode: codigoExtrair }),
  no('Abrir página da vaga', 'n8n-nodes-base.httpRequest', 4.2, [720, 100], {
    url: '={{ $json.link }}',
    options: {
      response: { response: { responseFormat: 'text' } },
      timeout: 15000,
    },
  }, { onError: 'continueRegularOutput' }),
  no('Montar pedido', 'n8n-nodes-base.code', 2, [960, 100], { mode: 'runOnceForEachItem', jsCode: codigoPedido }),
  no('Vaga encerrada?', 'n8n-nodes-base.if', 2.2, [1200, 100], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: 'encerrada',
        leftValue: '={{ $json.encerrada }}',
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  }),
  no('Marcar encerrada', 'n8n-nodes-base.code', 2, [1440, -100], { mode: 'runOnceForEachItem', jsCode: codigoEncerrada }),
  no('Classificar com Gemini', 'n8n-nodes-base.httpRequest', 4.2, [1440, 200], {
    method: 'POST',
    url: `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.pedido) }}',
    options: { batching: { batch: { batchSize: 1, batchInterval: INTERVALO_MS } } },
  }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, onError: 'continueRegularOutput' }),
  no('Ler resposta', 'n8n-nodes-base.code', 2, [1680, 200], { mode: 'runOnceForEachItem', jsCode: codigoLer }),
  no('Gravar na planilha', 'n8n-nodes-base.googleSheets', 4.5, [1920, 100], {
    operation: 'appendOrUpdate',
    documentId: { __rl: true, mode: 'url', value: '' },
    sheetName: { __rl: true, mode: 'name', value: 'Vagas' },
    columns: {
      mappingMode: 'autoMapInputData',
      value: {},
      matchingColumns: ['link'],
      schema: [],
    },
    options: {},
  }),
];

const liga = (de, para) => ({ [de]: { main: [[{ node: para, type: 'main', index: 0 }]] } });
const connections = Object.assign(
  liga('Executar manualmente', 'Buscar e-mails de vagas'),
  liga('Todo dia 8h30 e 14h30', 'Buscar e-mails de vagas'),
  liga('Buscar e-mails de vagas', 'Extrair vagas'),
  liga('Extrair vagas', 'Abrir página da vaga'),
  liga('Abrir página da vaga', 'Montar pedido'),
  liga('Montar pedido', 'Vaga encerrada?'),
  { 'Vaga encerrada?': { main: [
    [{ node: 'Marcar encerrada', type: 'main', index: 0 }],
    [{ node: 'Classificar com Gemini', type: 'main', index: 0 }],
  ] } },
  liga('Marcar encerrada', 'Gravar na planilha'),
  liga('Classificar com Gemini', 'Ler resposta'),
  liga('Ler resposta', 'Gravar na planilha'),
);

const workflow = {
  name: 'Radar de vagas (Gmail → Gemini → Sheets)',
  nodes,
  connections,
  settings: { executionOrder: 'v1', timezone: 'America/Sao_Paulo' },
  active: false,
};

const destino = path.join(raiz, 'workflow', 'radar-vagas.json');
fs.writeFileSync(destino, JSON.stringify(workflow, null, 2) + '\n');
console.log(`ok: ${destino} (${nodes.length} nós)`);

const test = require('node:test');
const assert = require('node:assert');
const { extrairVagas, desembrulharLink } = require('../src/extrair_vagas');
const { htmlParaTexto, montarPedido, lerResposta, vagaEncerrada } = require('../src/classificar');

// Cópia do formato real de um e-mail da rotina (31/10/2026).
const EMAIL = `— Não confirmadas (confira antes) —

Summer Internship 2027 | Software Engineering
VTEX · Remoto
https://www.google.com/url?q=https://remoteleaf.com/company/vtex/summer-internship-2027-software-engineering-brazil/&source=gmail&ust=1793553015946000&sa=E

Software Engineering Intern (Brazil)
LunarTech AI · Remoto
https://www.google.com/url?q=https://remoterocketship.com/company/lunartech-ai/jobs/software-engineering-intern-brazil&source=gmail&ust=1793553015946000&sa=E

Controle: https://www.google.com/url?q=https://claude.ai/artifact/LBSbfUgYX1wYqgToZeRWid&source=gmail&ust=1793553015946000&sa=E`;

test('extrai as vagas do e-mail real, sem a linha de controle', () => {
  const vagas = extrairVagas(EMAIL);
  assert.strictEqual(vagas.length, 2);
  assert.deepStrictEqual(vagas[0], {
    titulo: 'Summer Internship 2027 | Software Engineering',
    empresa: 'VTEX',
    local: 'Remoto',
    link: 'https://remoteleaf.com/company/vtex/summer-internship-2027-software-engineering-brazil/',
    confirmada: false,
  });
  assert.strictEqual(vagas[1].empresa, 'LunarTech AI');
});

test('vagas antes do aviso "não confirmadas" ficam como confirmadas', () => {
  const vagas = extrairVagas('Estágio QA\nNexti · Remoto\nhttps://x.com/1\n\n— Não confirmadas —\n\nDev Jr\nAcme · SP\nhttps://x.com/2');
  assert.deepStrictEqual(vagas.map((v) => v.confirmada), [true, false]);
});

test('e-mail sem vagas e CRLF do Windows', () => {
  assert.deepStrictEqual(extrairVagas(''), []);
  assert.strictEqual(extrairVagas('Dev Jr\r\nAcme · Remoto\r\nhttps://x.com/a\r\n').length, 1);
});

test('desembrulha link do Gmail com caracteres codificados', () => {
  assert.strictEqual(desembrulharLink('https://www.google.com/url?q=https://a.com/b%3Fc%3D1&sa=E'), 'https://a.com/b?c=1');
  assert.strictEqual(desembrulharLink('https://a.com'), 'https://a.com');
});

test('html vira texto sem script/style e com limite', () => {
  const t = htmlParaTexto('<style>x{}</style><h1>Vaga</h1><script>alert(1)</script><p>Python&nbsp;e SQL</p>');
  assert.strictEqual(t, 'Vaga Python e SQL');
  assert.strictEqual(htmlParaTexto('<p>' + 'a'.repeat(9000) + '</p>').length, 6000);
});

test('pedido leva perfil, regras e schema JSON; sem página pede confiança baixa', () => {
  const p = montarPedido({ titulo: 'Estágio Python', empresa: 'X', local: 'Remoto', link: 'https://x' }, '');
  const texto = p.contents[0].parts[0].text;
  assert.match(texto, /Faixa 1/);
  assert.match(texto, /Inglês intermediário/);
  assert.match(texto, /confianca "baixa"/);
  assert.strictEqual(p.generationConfig.responseMimeType, 'application/json');
});

test('lê resposta JSON do Gemini e trata resposta quebrada', () => {
  const ok = { candidates: [{ content: { parts: [{ text: '{"faixa":"1","nivel":"estagio","remoto":"sim","motivo":"ok","confianca":"alta"}' }] } }] };
  assert.strictEqual(lerResposta(ok).faixa, '1');
  assert.strictEqual(lerResposta({}).faixa, 'erro');
  const ruim = { candidates: [{ content: { parts: [{ text: '{"faixa":"7"}' }] } }] };
  assert.strictEqual(lerResposta(ruim).faixa, 'erro');
});

// Regressão (execução real de 01/11/2026): 5 das 6 vagas estavam fora do ar (HTTP 404/410),
// o fluxo mandava "página indisponível" para a IA e ela chutava Faixa 1 ou 2 pelo título.
test('vaga fora do ar (404/410) é marcada como encerrada, sem IA', () => {
  assert.match(vagaEncerrada({ error: { message: '410 - "<!DOCTYPE html>..."' } }), /410/);
  assert.match(vagaEncerrada({ error: { message: '404 - "<!DOCTYPE html>..."' } }), /404/);
});

test('página que diz que o processo acabou é marcada como encerrada', () => {
  const paginas = [
    '<h1>Processo seletivo encerrado</h1><p>O processo seletivo da Infosimples foi encerrado.</p>',
    'This job listing does not exist anymore, sorry!',
    'This job listing is archived, sorry!',
    'Esta vaga não está mais disponível',
  ];
  for (const html of paginas) assert.ok(vagaEncerrada({ data: html }), html);
});

test('vaga aberta, site bloqueado ou fora do ar temporário não viram "encerrada"', () => {
  assert.strictEqual(vagaEncerrada({ data: '<h1>Estágio Python</h1><p>Requisitos: SQL</p>' }), null);
  assert.strictEqual(vagaEncerrada({ error: { message: '403 - Forbidden' } }), null);
  assert.strictEqual(vagaEncerrada({ error: { message: 'timeout of 15000ms exceeded' } }), null);
  assert.strictEqual(vagaEncerrada({}), null);
});

// Extrai as vagas do texto de um e-mail "Vagas Estágio/Jr".
//
// Formato do e-mail (um bloco por vaga, separados por linha em branco):
//   Título da vaga
//   Empresa · Local
//   https://link
// Uma linha "— Não confirmadas ... —" marca as vagas seguintes como não conferidas.
// O Gmail embrulha links em https://www.google.com/url?q=<link>&...; desembrulhamos.

function desembrulharLink(url) {
  const m = url.match(/^https?:\/\/www\.google\.com\/url\?q=([^&\s]+)/);
  return m ? decodeURIComponent(m[1]) : url;
}

function extrairVagas(texto) {
  const vagas = [];
  let confirmada = true;
  const blocos = String(texto || '').replace(/\r/g, '').split(/\n\s*\n/);
  for (const bloco of blocos) {
    const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 1 && /^—.*não confirmad/i.test(linhas[0])) {
      confirmada = false;
      continue;
    }
    const iLink = linhas.findIndex((l) => /^https?:\/\//.test(l));
    if (iLink < 1 || /^controle:/i.test(linhas[0])) continue;
    // Com 2+ linhas antes do link, a linha logo acima dele é "Empresa · Local".
    const [empresa = '', local = ''] = iLink >= 2 ? linhas[iLink - 1].split('·').map((s) => s.trim()) : [];
    vagas.push({
      titulo: linhas[0],
      empresa,
      local,
      link: desembrulharLink(linhas[iLink]),
      confirmada,
    });
  }
  return vagas;
}

module.exports = { extrairVagas, desembrulharLink };

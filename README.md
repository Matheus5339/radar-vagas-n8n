# radar-vagas-n8n

Automação em **n8n** que lê os e-mails diários de vagas de estágio/júnior,
**classifica cada vaga com IA (Gemini)** em faixas de chance e grava tudo numa
**planilha Google que funciona como dashboard**.

**Dashboard (somente leitura):** [planilha "Radar de vagas"](https://docs.google.com/spreadsheets/d/102bghG5QpQbgYsi6ce14hVn-DLDwkXXaHup58c3ZG7A/edit?usp=sharing) (aba `Resumo` com o gráfico por faixa; aba `Vagas` com o motivo de cada classificação)

## O problema

Eu recebo duas vezes por dia um e-mail "Vagas Estágio/Jr" com vagas novas
(título, empresa, local e link). Para cada uma eu precisava abrir o link, ler os
requisitos, comparar com o meu perfil e decidir se valia a pena (Faixa 1, 2 ou 3).

## Tempo economizado (medido em 01/11/2026)

| | Vagas | Tempo |
|---|---|---|
| Triagem manual (eu, cronometrado: abrir cada link, ler, decidir a faixa, anotar) | 6 | **5 min 45 s** (~58 s por vaga) |
| Workflow, 1ª versão (todas as vagas passavam pelo Gemini) | 6 | 1 min 17 s (72 s são a pausa obrigatória entre chamadas do plano gratuito) |
| Workflow, versão atual (vaga encerrada não passa pela IA) | 8 | **7,1 s** |

Tempos do workflow registrados pelo próprio n8n (aba *Executions*). Com o agendamento,
o meu tempo de atenção cai para o de abrir a planilha.

Ressalvas honestas:
- Amostra pequena (um dia de e-mails).
- Todas as vagas medidas já estavam encerradas, então o tempo manual é o **melhor caso**:
  eu só abri o link e vi "vaga encerrada". Com vagas abertas, ler os requisitos leva
  mais tempo, e o workflow passa a gastar ~13 s por vaga no Gemini.
- A 2ª execução pegou um e-mail novo e o mais antigo saiu da janela
  de 2 dias (8 vagas), por isso não é exatamente o mesmo conjunto da 1ª.

**O que a medição revelou:** na 1ª versão, 5 das 6 vagas estavam fora do ar
(HTTP 404/410) e a IA, sem texto, deu Faixa 1 ou 2 pelo título. Isso virou um teste
de regressão e uma regra sem IA (ver Decisões). Na versão atual, as 8 vagas foram
marcadas como `encerrada` com o código HTTP como motivo, sem nenhuma chamada ao Gemini.

## Fluxo

```
Gatilho (manual ou 8h30/14h30)
  → Gmail: e-mails "Vagas Estágio/Jr" dos últimos 2 dias
  → Code: extrai título, empresa, local e link de cada vaga (sem repetir link)
  → HTTP: abre a página da vaga (se o site bloquear, segue só com o título)
  → Code: página 404/410 ou com "processo encerrado"? → faixa "encerrada", sem IA
          senão limpa o HTML e monta o pedido (perfil + regras + texto da vaga)
  → HTTP: Gemini com saída em JSON (schema), 1 chamada a cada 13 s
  → Code: valida a resposta
  → Google Sheets: grava ou atualiza a linha da vaga (chave = link)
```

Saída por vaga: `faixa` (1, 2, 3, fora ou encerrada), `nivel`, `remoto`, `motivo` (até 25 palavras),
`confianca` (baixa quando a página não abriu).

## Decisões

- **Prompt com regras verificáveis**, não "avalie a chance": estágio sem exigência
  de experiência = Faixa 1; júnior com lacuna = 2; experiência exigida, inglês
  fluente, stack central que eu não tenho ou horário noturno = 3. O pior critério manda.
- **Perfil explícito no prompt, inclusive o que eu NÃO sei**, para a IA não supor.
- **Saída em JSON com schema** (`responseSchema`) e validação no nó seguinte: se a
  resposta vier quebrada, a vaga fica com faixa `erro` em vez de travar o fluxo.
- **Vaga encerrada é detectada por regra, não pela IA.** Na primeira execução real,
  5 de 6 vagas estavam fora do ar (HTTP 404/410); sem texto, a IA classificava pelo
  título e dava Faixa 1 ou 2. Agora 404/410 ou frases como "processo seletivo
  encerrado" marcam a vaga como `encerrada` sem chamar o Gemini (teste de regressão
  em `tests/`). 403 e timeout não contam: podem ser site que bloqueia robô.
- **Texto da vaga tratado como dado** (proteção contra prompt injection em anúncios).
- **Código dos nós Code testado fora do n8n:** a lógica fica em `src/`, com testes
  em `tests/` (`npm test`); `npm run workflow` gera o `workflow/radar-vagas.json`
  com esse mesmo código.
- **Cota gratuita do Gemini (5 chamadas/min):** o nó HTTP envia 1 pedido a cada 13 s
  e tenta de novo até 3 vezes.
- **Custo zero:** n8n self-hosted no Docker do meu PC, Gemini no plano gratuito,
  Google Sheets. O n8n escuta só em `127.0.0.1` (não fica exposto na internet).
- **Segredos fora do repositório:** credenciais (Google OAuth, chave do Gemini) ficam
  no cofre de credenciais do n8n, no meu PC.

## Como rodar

Passo a passo completo em [`docs/CONFIGURAR.md`](docs/CONFIGURAR.md). Resumo:

```bash
npm test                 # testa extração, limpeza de HTML, prompt e leitura da resposta
npm run workflow         # gera workflow/radar-vagas.json a partir de src/
```

Depois: subir o n8n no Docker, importar o workflow, criar as credenciais e executar.

## Limitações

- Roda no meu PC: o agendamento só funciona com o PC ligado e o Docker aberto.
- Sites que exigem login ou bloqueiam robôs: a vaga é classificada só pelo título
  (confiança baixa) e eu confiro à mão.
- A IA pode errar a faixa; a planilha é uma triagem, a decisão final é minha.
- No plano gratuito, o Google pode usar o conteúdo enviado ao Gemini para melhorar
  os produtos dele: só vai texto público de anúncios de vaga e o meu perfil resumido,
  sem dados pessoais (nome, e-mail, telefone).

## Autoria

Construído com apoio de IA (Claude, da Anthropic) sob minha direção: eu defini o
problema (a minha rotina de busca), os critérios de faixa e as regras de custo e
segurança; a IA gerou boa parte do código.

Matheus de Oliveira Pereira · [github.com/Matheus5339](https://github.com/Matheus5339)

Licença: [MIT](LICENSE).

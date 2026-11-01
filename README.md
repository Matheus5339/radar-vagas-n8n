# radar-vagas-n8n

Automação em **n8n** que lê os e-mails diários de vagas de estágio/júnior,
**classifica cada vaga com IA (Gemini)** em faixas de chance e grava tudo numa
**planilha Google que funciona como dashboard**.

**Dashboard (somente leitura):** _(link da planilha)_

## O problema

Eu recebo duas vezes por dia um e-mail "Vagas Estágio/Jr" com vagas novas
(título, empresa, local e link). Para cada uma eu precisava abrir o link, ler os
requisitos, comparar com o meu perfil e decidir se valia a pena (Faixa 1, 2 ou 3).

## Tempo economizado (medido)

| | Tempo |
|---|---|
| Classificação manual de _N_ vagas (cronometrada) | _a medir_ |
| Execução do workflow para as mesmas vagas (tempo registrado pelo n8n) | _a medir_ |

_Os números só entram aqui depois de medidos de verdade._

## Fluxo

```
Gatilho (manual ou 8h30/14h30)
  → Gmail: e-mails "Vagas Estágio/Jr" dos últimos 2 dias
  → Code: extrai título, empresa, local e link de cada vaga (sem repetir link)
  → HTTP: abre a página da vaga (se o site bloquear, segue só com o título)
  → Code: limpa o HTML e monta o pedido (perfil + regras + texto da vaga)
  → HTTP: Gemini com saída em JSON (schema), 1 chamada a cada 13 s
  → Code: valida a resposta
  → Google Sheets: grava ou atualiza a linha da vaga (chave = link)
```

Saída por vaga: `faixa` (1, 2, 3 ou fora), `nivel`, `remoto`, `motivo` (até 25 palavras),
`confianca` (baixa quando a página não abriu).

## Decisões

- **Prompt com regras verificáveis**, não "avalie a chance": estágio sem exigência
  de experiência = Faixa 1; júnior com lacuna = 2; experiência exigida, inglês
  fluente, stack central que eu não tenho ou horário noturno = 3. O pior critério manda.
- **Perfil explícito no prompt, inclusive o que eu NÃO sei**, para a IA não supor.
- **Saída em JSON com schema** (`responseSchema`) e validação no nó seguinte: se a
  resposta vier quebrada, a vaga fica com faixa `erro` em vez de travar o fluxo.
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

# radar-vagas-n8n

Projeto de portfólio do Matheus para a vaga iFood GenAI (trilha AI Builder), 31/10/2026.
Repositório: `github.com/Matheus5339/radar-vagas-n8n` (público).

## Decisões
- n8n self-hosted no Docker do PC dele (contêiner `n8n`, volume `n8n_data`, porta só em 127.0.0.1).
- Lógica dos nós Code em `src/` com testes `node --test`; `npm run workflow` gera o JSON.
- Gemini via nó HTTP (Header Auth `x-goog-api-key`), modelo gemini-3.6-flash, 1 chamada/13 s (free tier: 5/min).
- Credenciais (Google OAuth, chave Gemini) só no n8n. Nada de segredo no repositório.
- **Número de tempo economizado só entra no README se medido de verdade** (regra dele).
- Critérios de faixa vêm de `carreira/CLAUDE.md` ("Manter a busca atualizada").

## Pendências
- Código escrito pelo Claude a pedido dele; ele vai estudar para defender em entrevista.

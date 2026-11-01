# Aba "Resumo" (dashboard) — fórmulas para colar

Crie uma aba chamada `Resumo` na mesma planilha e cole:

| Célula | Conteúdo |
|---|---|
| A1 | `Faixa` |
| B1 | `Vagas` |
| A2 | `1` |
| A3 | `2` |
| A4 | `3` |
| A5 | `fora` |
| A6 | `encerrada` |
| A7 | `erro` |
| B2 | `=CONT.SE(Vagas!E:E;A2)` (arraste até B7) |
| A8 | `Total classificadas` |
| B8 | `=CONT.VALORES(Vagas!A2:A)` |
| A9 | `Confiança baixa (página não abriu)` |
| B9 | `=CONT.SE(Vagas!I:I;"baixa")` |
| A10 | `Última execução` |
| B10 | `=ÍNDICE(Vagas!L:L;CONT.VALORES(Vagas!L:L))` (última linha gravada) |

Gráfico: selecione `A1:B6` → Inserir → Gráfico → **Gráfico de colunas**.

Faixa 1 em destaque na aba `Vagas`: selecione a coluna E → Formatar → Formatação condicional →
"O texto é exatamente" `1` → fundo verde.

Planilha em inglês? Use `COUNTIF`, `COUNTA` e `INDEX`, com vírgula no lugar de ponto e vírgula.

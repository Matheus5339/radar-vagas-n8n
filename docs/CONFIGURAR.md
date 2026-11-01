# Configurar o radar (feito uma vez, pelo dono da conta)

Tudo aqui é gratuito e **não pede cartão**. Se alguma tela pedir faturamento, pare.
Nenhum segredo (senha, Client Secret, chave) vai para o Git, para o chat ou para o código:
eles ficam só nas credenciais do n8n, que ficam no volume Docker `n8n_data` do seu PC.

## 1. Subir o n8n (local)

```bash
docker run -d --name n8n --restart unless-stopped -p 127.0.0.1:5678:5678 -v n8n_data:/home/node/.n8n -e GENERIC_TIMEZONE=America/Sao_Paulo -e TZ=America/Sao_Paulo docker.n8n.io/n8nio/n8n:latest
```

Abra http://localhost:5678 e crie o usuário dono (só existe no seu PC).
Importe `workflow/radar-vagas.json` (menu ⋯ → *Import from file*).

## 2. Google Cloud: cliente OAuth para Gmail e Sheets

Em https://console.cloud.google.com, no projeto **Default Gemini Project**:

1. **APIs e serviços → Biblioteca**: ative **Gmail API**, **Google Sheets API** e **Google Drive API**.
2. **Google Auth Platform → Branding / Tela de consentimento**: tipo **Externo**, nome `radar-vagas`, seu e-mail.
3. **Público → Usuários de teste**: adicione o e-mail que recebe os avisos de vagas.
4. **Clientes → Criar cliente → Aplicativo da Web**.
   URI de redirecionamento autorizado: `http://localhost:5678/rest/oauth2-credential/callback`
5. Deixe a tela com **Client ID** e **Client Secret** aberta para o passo 3 (não copie para outro lugar).

## 3. Credenciais no n8n

No n8n: **Credentials → Create**:

| Credencial | O que preencher |
|---|---|
| **Gmail OAuth2 API** | Client ID e Client Secret → *Sign in with Google* com a conta que recebe os e-mails. Aviso "app não verificado" → *Continuar* (o app é seu). Permissão: leitura. |
| **Google Sheets OAuth2 API** | mesmo Client ID/Secret → *Sign in with Google*. |
| **Header Auth** (nome: `Gemini`) | Name: `x-goog-api-key` · Value: sua chave do Google AI Studio |

## 4. Planilha (o dashboard)

1. Crie uma planilha no Google Sheets chamada `Radar de vagas`, com uma aba `Vagas`.
2. Na aba `Vagas`: Arquivo → Importar → `planilha/Vagas_cabecalho.csv` → "Substituir planilha atual"
   (só cria a linha de cabeçalho).
3. Monte a aba `Resumo` com `planilha/RESUMO_formulas.md`.
4. Compartilhar → "Qualquer pessoa com o link" → **Leitor**. Esse é o link público do README.

## 5. Ligar tudo no workflow

Abra o workflow e, em cada nó:
- **Buscar e-mails de vagas** → credencial Gmail.
- **Classificar com Gemini** → credencial `Gemini` (Header Auth).
- **Gravar na planilha** → credencial Sheets + cole a URL da planilha em *Document*.

Clique em **Execute workflow**. Para rodar sozinho às 8h30 e 14h30, ative o workflow
(o PC precisa estar ligado com o Docker aberto).

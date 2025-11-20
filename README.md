# selfbot discord - purge instantaneo

selfbot discord que apaga todas as suas mensagens instantaneamente quando voce digita "cl" em qualquer lugar (dm, servidor, grupo).

## features

- painel web minimalista preto
- login com discord oauth2 (opcional)
- delecao ultra rapida (10 lotes paralelos de 100 mensagens)
- funciona em dm, servidores e grupos
- bot inicia automaticamente ao salvar token
- health check endpoint
- auto-redeploy quando servico cai (webhook render)
- commit automatico via api github

## deployment no render (gratis)

veja [DEPLOYMENT.md](DEPLOYMENT.md) para instrucoes completas.

### resumo rapido:

1. fork este repositorio
2. crie conta no render.com
3. conecte este repo ao render
4. deploy automatico!
5. configure uptimerobot para manter 24/7

## como usar

1. acesse o painel web
2. (opcional) faca login com discord
3. cole seu token de usuario discord
4. digite "cl" em qualquer conversa para apagar tudo

## commit automatico via github api

o script detecta automaticamente todos os arquivos do projeto (exceto os listados no .gitignore) e faz commit de tudo via api do github.

**usando o script bash:**
```bash
export GITHUB_TOKEN="seu_token_github"
export GITHUB_REPO_OWNER="seu_usuario"
export GITHUB_REPO_NAME="nome_do_repo"
export COMMIT_MESSAGE="update: descricao do commit"
./commit.sh
```

**ou diretamente com node:**
```bash
export GITHUB_TOKEN="seu_token_github"
export GITHUB_REPO_OWNER="seu_usuario"
export GITHUB_REPO_NAME="nome_do_repo"
export COMMIT_MESSAGE="update: descricao do commit"
node deploy-github.js
```

o script respeita o .gitignore e ignora automaticamente:
- node_modules/
- .git/
- tmp/
- attached_assets/
- qualquer arquivo/pasta listado no .gitignore

## endpoints disponiveis

- `GET /` - painel web principal
- `GET /health` - health check (status do servidor e bot)
- `GET /api/auth/discord` - inicia oauth2 discord
- `GET /api/callback` - callback oauth2
- `GET /api/user` - retorna usuario logado
- `POST /api/logout` - faz logout
- `POST /api/save-token` - salva token do bot
- `POST /api/webhook/render` - webhook para auto-redeploy

## aviso

este e um selfbot. uso de selfbots viola os termos de servico do discord. use por sua conta e risco.

## variaveis de ambiente

veja `.env.example` para todas as variaveis disponiveis.

**obrigatorias:**
- `SESSION_SECRET` - chave secreta para sessoes

**opcionais:**
- `DISCORD_CLIENT_ID` - id do app discord (oauth2)
- `DISCORD_CLIENT_SECRET` - secret do app discord (oauth2)
- `DISCORD_REDIRECT_URI` - url de callback oauth2
- `RENDER_DEPLOY_HOOK` - url do deploy hook do render
- `ALLOW_PUBLIC_TOKEN_SAVE` - permite salvar token sem login (true/false)

## tecnologias

- node.js
- express
- discord.js-selfbot-v13
- express-session
- axios
- @octokit/rest

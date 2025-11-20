# deployment no render (gratuito) + uptimerobot

## passo 1: conectar github

### no replit:
1. va no painel lateral esquerdo
2. clique no icone do github (version control)
3. clique em "connect to github"
4. autorize o replit a acessar sua conta github
5. crie um novo repositorio ou conecte a um existente

### alternativa via integracao:
o replit tem integracao nativa com github que facilita muito. use a integracao github disponivel.

## passo 2: fazer push do codigo

### pelo replit (metodo facil):
1. abra o painel git no replit
2. escreva uma mensagem de commit: "initial commit - selfbot discord"
3. clique em "commit & push"
4. pronto! codigo esta no github

### pelo terminal (metodo manual):
```bash
git add .
git commit -m "initial commit - selfbot discord"
git push origin main
```

## passo 3: deployment no render

### criar conta e conectar:
1. acesse: https://render.com
2. faca login com sua conta github
3. clique em "new +" > "web service"
4. conecte seu repositorio github
5. selecione o repositorio do selfbot

### configurar deployment:
- **name**: selfbot-discord (ou qualquer nome)
- **environment**: node
- **node version**: 18 ou superior
- **build command**: `npm install`
- **start command**: `node server.js`
- **plan**: free

### importante - porta automatica:
o render fornece a porta automaticamente via variavel PORT. o server.js ja esta configurado para usar `process.env.PORT || 5000`, entao vai funcionar perfeitamente no render.

### adicionar variaveis de ambiente:
no painel do render, va em "environment" e adicione:

**obrigatorias:**
- `NODE_ENV` = `production`
- `SESSION_SECRET` = `sua-chave-secreta-aleatoria-aqui`

**opcionais (para login com discord):**
- `DISCORD_CLIENT_ID` = id do seu app discord
- `DISCORD_CLIENT_SECRET` = secret do seu app discord
- `DISCORD_REDIRECT_URI` = `https://seu-app.onrender.com/api/callback`

**opcional (para auto-redeploy):**
- `RENDER_DEPLOY_HOOK` = url do deploy hook (veja passo 6)
- `RENDER_WEBHOOK_SECRET` = chave secreta para webhook (recomendado)

**opcional (sem oauth2):**
- `ALLOW_PUBLIC_TOKEN_SAVE` = `true` (permite salvar token sem login)

a variavel PORT e fornecida automaticamente pelo render

### deploy:
1. clique em "create web service"
2. aguarde o build terminar (1-3 minutos)
3. seu bot estara no ar!

## passo 4: configurar discord oauth2 (opcional mas recomendado)

### criar aplicacao discord:
1. acesse: https://discord.com/developers/applications
2. clique em "new application"
3. de um nome (ex: "selfbot manager")
4. va em "oauth2" > "general"
5. copie o **client id** e **client secret**
6. em "redirects", adicione: `https://seu-app.onrender.com/api/callback`
7. salve

### adicionar no render:
volte no painel do render > environment e adicione as 3 variaveis:
- DISCORD_CLIENT_ID
- DISCORD_CLIENT_SECRET  
- DISCORD_REDIRECT_URI

agora voce pode fazer login com discord no painel web!

## passo 5: configurar uptimerobot (24/7 gratis)

### problema do render free:
- tier gratuito do render dorme apos 15 minutos sem atividade
- precisamos fazer ping a cada 5 minutos

### solucao - uptimerobot:
1. acesse: https://uptimerobot.com
2. crie conta gratuita
3. clique em "+ add new monitor"
4. configure:
   - **monitor type**: http(s)
   - **friendly name**: selfbot discord
   - **url**: https://seu-app.onrender.com
   - **monitoring interval**: 5 minutes
5. clique em "create monitor"

pronto! o uptimerobot vai fazer ping a cada 5 minutos e manter seu bot sempre acordado.

## passo 6: configurar auto-redeploy (quando o servico cai)

### no render:
1. va nas configuracoes do seu servico
2. procure por "deploy hook"
3. copie a url (algo como: `https://api.render.com/deploy/srv-xxxxx`)
4. adicione como variavel de ambiente no render:
   - `RENDER_DEPLOY_HOOK` = `url copiada`

### webhook do render (opcional - requer plano pago):
se tiver plano professional do render:
1. va em settings > webhooks
2. adicione webhook apontando para: `https://seu-app.onrender.com/api/webhook/render`
3. selecione eventos: `service_unavailable`
4. adicione header `x-render-secret` com valor da variavel `RENDER_WEBHOOK_SECRET`
5. quando o servico cair, ele fara redeploy automatico

**nota:** o uptimerobot ja mantem o bot ativo. o webhook e uma camada extra opcional de seguranca.

## passo 7: usar o bot

1. acesse a url do render: https://seu-app.onrender.com
2. **opcao 1 - login com discord:**
   - clique em "entrar com discord"
   - autorize o app
   - depois cole seu token de usuario
3. **opcao 2 - sem login:**
   - certifique-se que `ALLOW_PUBLIC_TOKEN_SAVE=true` esta configurado
   - cole seu token de usuario diretamente
4. clique em "salvar token"
5. o bot vai conectar automaticamente
6. digite "cl" em qualquer conversa para apagar tudo

## manutencao

### atualizar codigo via github:
**metodo 1 - manual:**
1. faca mudancas no replit
2. commit e push pelo painel git
3. render detecta automaticamente e faz redeploy

**metodo 2 - api automatica:**
```bash
export GITHUB_TOKEN="seu_token_github"
export GITHUB_REPO_OWNER="seu_usuario"
export GITHUB_REPO_NAME="nome_do_repo"
export COMMIT_MESSAGE="update: nova feature"
node deploy-github.js
```

### ver logs:
- no render, clique em "logs" para ver o console do bot
- la voce vera mensagens como "conectado como [seu usuario]"

### health check:
acesse `https://seu-app.onrender.com/health` para ver status do servidor

## troubleshooting

### bot nao conecta:
- verifique se o token esta correto
- veja os logs no render

### render dormindo:
- confirme que o uptimerobot esta ativo
- verifique se o monitor esta com status "up"

### deployment falhou:
- veja os logs de build no render
- confirme que package.json esta correto
- node version deve ser >= 16.9.0

## resumo rapido

```
replit > github > render > uptimerobot
  |        |        |          |
 code    push    deploy    keep alive
```

tudo gratuito, 24/7 no ar!

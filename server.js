const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const session = require('express-session');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('static'));

// Trust proxy headers (importante para Render, Heroku, etc)
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-key-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const RENDER_DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK;
const RENDER_WEBHOOK_SECRET = process.env.RENDER_WEBHOOK_SECRET;

let DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

let botProcess = null;

function startBot() {
    if (botProcess) {
        console.log('matando processo antigo do bot...');
        botProcess.kill();
        botProcess = null;
    }

    const tokenFilePath = path.join(__dirname, 'user_token.txt');
    
    if (!fs.existsSync(tokenFilePath)) {
        console.log('user_token.txt nao existe ainda');
        return;
    }

    const token = fs.readFileSync(tokenFilePath, 'utf-8').trim();
    
    if (!token) {
        console.log('token vazio');
        return;
    }

    console.log('iniciando bot...');
    
    botProcess = spawn('node', ['bot.js'], {
        env: { ...process.env, DISCORD_USER_TOKEN: token },
        stdio: 'inherit'
    });

    botProcess.on('error', (error) => {
        console.error('erro ao iniciar bot:', error);
    });

    botProcess.on('exit', (code) => {
        console.log(`bot encerrou com codigo ${code}`);
        botProcess = null;
    });
}

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        uptime: process.uptime(),
        bot_running: botProcess !== null,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/api/debug', (req, res) => {
    res.json({
        discord_client_id: DISCORD_CLIENT_ID ? 'configurado' : 'NAO CONFIGURADO',
        discord_client_secret: DISCORD_CLIENT_SECRET ? 'configurado' : 'NAO CONFIGURADO',
        node_env: process.env.NODE_ENV,
        host: req.get('host'),
        protocol: req.protocol
    });
});

app.get('/api/auth/discord', (req, res) => {
    const host = req.get('host');
    // Em produção, sempre HTTPS. Render/proxies usam x-forwarded-proto
    const protocol = req.get('x-forwarded-proto') || req.protocol || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    
    console.log('OAuth - host:', host, 'protocol:', protocol, 'NODE_ENV:', process.env.NODE_ENV);
    
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        console.error('ERRO: Discord OAuth nao configurado');
        return res.status(500).json({ 
            error: 'Discord OAuth nao esta configurado. Adicione DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas env vars do Render.' 
        });
    }
    
    const redirectUri = `${protocol}://${host}/api/callback`;
    
    console.log('OAuth redirect_uri:', redirectUri);
    
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'identify email'
    });
    
    const authUrl = `https://discord.com/api/oauth2/authorize?${params}`;
    res.redirect(authUrl);
});

app.get('/api/callback', async (req, res) => {
    const { code, error } = req.query;
    
    console.log('callback discord recebido - code:', !!code, 'error:', error);
    
    if (error) {
        console.error('discord oauth error:', error);
        return res.redirect('/?error=usuario_cancelou');
    }
    
    if (!code) {
        return res.redirect('/?error=codigo_invalido');
    }
    
    try {
        console.log('trocando codigo por token...');
        
        const protocol = req.get('x-forwarded-proto') || req.protocol || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
        const host = req.get('host');
        const redirectUri = DISCORD_REDIRECT_URI || `${protocol}://${host}/api/callback`;
        
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('token obtido com sucesso');
        const { access_token } = tokenResponse.data;
        
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });
        
        console.log('usuario obtido:', userResponse.data.username);
        
        req.session.user = userResponse.data;
        req.session.loggedIn = true;
        
        // Redireciona para página que extrai token automaticamente
        res.redirect('/?login=success&extract_token=true');
        
    } catch (error) {
        console.error('erro oauth completo:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url
        });
        res.redirect('/?error=autenticacao_falhou');
    }
});

app.get('/api/user', (req, res) => {
    if (req.session.loggedIn && req.session.user) {
        res.json({ 
            loggedIn: true,
            user: {
                username: req.session.user.username,
                discriminator: req.session.user.discriminator,
                id: req.session.user.id,
                avatar: req.session.user.avatar
            }
        });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'logout realizado' });
});

app.get('/extract-token', (req, res) => {
    // Página que roda no Discord e extrai o token automaticamente
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Extracting Token...</title>
</head>
<body>
    <h1>Extraindo token...</h1>
    <p id="status">Aguarde...</p>
    <script>
        try {
            const token = localStorage.getItem('token').split('"')[1];
            if (token && token.length > 50) {
                document.getElementById('status').textContent = 'Token encontrado! Enviando...';
                
                // Envia para o painel original
                if (window.opener) {
                    window.opener.postMessage({
                        type: 'DISCORD_TOKEN',
                        token: token
                    }, window.opener.location.origin);
                    document.getElementById('status').textContent = 'Token enviado! Você pode fechar esta aba.';
                } else {
                    // Se não tiver opener, tenta redirecionah pro painel
                    fetch('/api/auto-save-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: token })
                    }).then(r => r.json()).then(data => {
                        document.getElementById('status').innerHTML = data.message + '<br><a href="/">Voltar ao painel</a>';
                    });
                }
            } else {
                document.getElementById('status').textContent = 'Erro: Token não encontrado. Certifique-se que está conectado ao Discord.';
            }
        } catch (e) {
            document.getElementById('status').textContent = 'Erro: ' + e.message;
        }
    </script>
</body>
</html>
    `;
    res.send(html);
});

app.post('/api/auto-save-token', (req, res) => {
    const { token } = req.body;
    
    if (!token || token.length < 50) {
        return res.status(400).json({ error: 'token invalido' });
    }

    try {
        const tokenFilePath = path.join(__dirname, 'user_token.txt');
        fs.writeFileSync(tokenFilePath, token.trim());
        
        console.log('token salvo automaticamente via extract-token');
        startBot();
        
        res.json({ message: 'token salvo e bot ativado!' });
    } catch (error) {
        console.error('erro ao salvar token:', error.message);
        res.status(500).json({ error: 'erro ao salvar token' });
    }
});

app.post('/api/save-token', (req, res) => {
    const { token } = req.body;
    
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'token vazio' });
    }

    try {
        const cleanToken = token.replace(/\s+/g, '').trim();
        
        if (!cleanToken) {
            return res.status(400).json({ error: 'token vazio apos limpeza' });
        }

        const tokenFilePath = path.join(__dirname, 'user_token.txt');
        fs.writeFileSync(tokenFilePath, cleanToken);
        
        console.log('token salvo com sucesso, iniciando bot...');
        
        startBot();
        
        res.json({ message: 'token salvo e bot iniciado' });
    } catch (error) {
        console.error('erro ao salvar token:', error.message);
        res.status(500).json({ error: 'erro: ' + error.message });
    }
});

app.post('/api/webhook/render', async (req, res) => {
    const webhookSecret = process.env.RENDER_WEBHOOK_SECRET;
    
    if (webhookSecret) {
        const providedSecret = req.headers['x-render-secret'] || req.body.secret;
        
        if (providedSecret !== webhookSecret) {
            console.log('webhook rejeitado: secret invalido');
            return res.status(401).json({ error: 'nao autorizado' });
        }
    }
    
    const { eventType, service } = req.body;
    
    console.log('webhook recebido:', { eventType, service });
    
    if (eventType === 'service_unavailable' || eventType === 'service_unavailable_hardware') {
        console.log('servico caiu, iniciando redeploy automatico...');
        
        if (RENDER_DEPLOY_HOOK) {
            try {
                await axios.post(RENDER_DEPLOY_HOOK);
                console.log('redeploy iniciado com sucesso');
                return res.json({ message: 'redeploy iniciado' });
            } catch (error) {
                console.error('erro ao iniciar redeploy:', error.message);
                return res.status(500).json({ error: 'falha ao iniciar redeploy' });
            }
        } else {
            console.log('render deploy hook nao configurado');
            return res.json({ message: 'webhook recebido mas deploy hook nao configurado' });
        }
    }
    
    res.json({ message: 'webhook recebido' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`servidor rodando na porta ${PORT}`);
    
    setTimeout(() => {
        startBot();
    }, 1000);
});

server.timeout = 300000;

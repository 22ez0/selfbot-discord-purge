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
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/api/callback';
const RENDER_DEPLOY_HOOK = process.env.RENDER_DEPLOY_HOOK;
const RENDER_WEBHOOK_SECRET = process.env.RENDER_WEBHOOK_SECRET;

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

app.get('/api/auth/discord', (req, res) => {
    if (!DISCORD_CLIENT_ID) {
        return res.status(500).json({ error: 'discord oauth nao configurado' });
    }
    
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify'
    });
    
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/api/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect('/?error=codigo_invalido');
    }
    
    try {
        const tokenResponse = await axios.post(
            'https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: DISCORD_REDIRECT_URI
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const { access_token } = tokenResponse.data;
        
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });
        
        req.session.user = userResponse.data;
        req.session.loggedIn = true;
        
        res.redirect('/?login=success');
        
    } catch (error) {
        console.error('erro oauth:', error.response?.data || error.message);
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

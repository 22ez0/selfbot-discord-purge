const { Client } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');

const client = new Client();

function getToken() {
    const tokenFilePath = path.join(__dirname, 'user_token.txt');
    
    if (fs.existsSync(tokenFilePath)) {
        return fs.readFileSync(tokenFilePath, 'utf-8').trim();
    }
    
    return process.env.DISCORD_USER_TOKEN;
}

const USER_TOKEN = getToken();

client.on('ready', () => {
    console.log(`conectado como ${client.user.tag}`);
    console.log('bot pronto - digite "cl" em qualquer lugar para apagar suas mensagens');
});

client.on('messageCreate', async (message) => {
    if (message.author.id !== client.user.id) return;
    if (message.content.toLowerCase() !== 'cl') return;

    try {
        console.log(`comando "cl" detectado - deletando tudo em velocidade MAXIMA...`);
        
        const startTime = Date.now();
        let deletedCount = 0;
        const allDeletePromises = [];
        
        async function fetchAndDelete(beforeId = null) {
            const options = { limit: 100 };
            if (beforeId) {
                options.before = beforeId;
            }

            const messages = await message.channel.messages.fetch(options);
            if (messages.size === 0) return null;

            const myMessages = messages.filter(msg => msg.author.id === client.user.id);
            
            myMessages.forEach(msg => {
                allDeletePromises.push(
                    msg.delete()
                        .then(() => deletedCount++)
                        .catch(() => {})
                );
            });

            return messages.last()?.id;
        }

        const streams = 50;
        const batchPromises = [];
        let lastIds = Array(streams).fill(null);
        
        while (true) {
            for (let i = 0; i < streams; i++) {
                batchPromises.push(
                    fetchAndDelete(lastIds[i]).then(newId => {
                        if (newId) lastIds[i] = newId;
                        return newId;
                    }).catch(() => null)
                );
            }

            const results = await Promise.allSettled(batchPromises);
            batchPromises.length = 0;

            if (results.every(r => r.status === 'fulfilled' && r.value === null)) break;
        }

        await Promise.allSettled(allDeletePromises);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${deletedCount} mensagens deletadas em ${elapsed}s`);

    } catch (error) {
        console.error('erro:', error);
    }
});

if (!USER_TOKEN) {
    console.error('erro: token nao encontrado. acesse o painel web para inserir seu token.');
    process.exit(0);
}

const loginTimeout = setTimeout(() => {
    console.error('timeout: bot nao conseguiu conectar em 30s');
    process.exit(0);
}, 30000);

client.on('ready', () => {
    clearTimeout(loginTimeout);
});

client.on('error', (error) => {
    console.error('erro discord:', error.message);
    clearTimeout(loginTimeout);
    process.exit(0);
});

client.login(USER_TOKEN);

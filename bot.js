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
        console.log(`comando "cl" detectado - deletando tudo em velocidade maxima...`);
        
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

        const batchPromises = [];
        let lastIds = [null, null, null, null, null, null, null, null, null, null];
        
        while (true) {
            for (let i = 0; i < lastIds.length; i++) {
                batchPromises.push(
                    fetchAndDelete(lastIds[i]).then(newId => {
                        if (newId) lastIds[i] = newId;
                        return newId;
                    })
                );
            }

            const results = await Promise.all(batchPromises);
            batchPromises.length = 0;

            if (results.every(id => id === null)) break;
        }

        await Promise.all(allDeletePromises);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`${deletedCount} mensagens deletadas em ${elapsed}s`);

    } catch (error) {
        console.error('erro:', error);
    }
});

if (!USER_TOKEN) {
    console.error('erro: token nao encontrado. acesse o painel web para inserir seu token.');
    process.exit(1);
}

client.login(USER_TOKEN);

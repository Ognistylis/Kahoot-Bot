const express = require('express');
const Kahoot = require("kahoot.js-latest");
const app = express();

app.use(express.json());

// Endpoint dla przycisku "Budź" w Godocie
app.get('/', (req, res) => {
    res.send("OK");
});

let activeClients = [];
let globalRejoin = false; 

// --- 1. STARTOWANIE BOTÓW ---
app.post('/atak', (req, res) => {
    const { pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay, rejoin } = req.body;
    
    console.log(`[ATAK] PIN: ${pin}, Rejoin: ${rejoin}`);
    
    globalRejoin = rejoin; 
    activeClients = []; 
    
    spawnBots(pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay);
    res.send({ status: "Atak rozpoczęty!" });
});

// --- 2. OBSŁUGA 2FA ---
app.post('/2fa', (req, res) => {
    const { code } = req.body;
    const digitCode = code.split('').map(Number);
    activeClients.forEach(client => {
        for(let i=0; i<3; i++) {
            setTimeout(() => { 
                if(client && client.answer2FA) client.answer2FA(digitCode).catch(()=>{}); 
            }, i * 500);
        }
    });
    res.send({ status: "Kod wysłany" });
});

async function spawnBots(pin, baseName, count, autoAnswer, minD, maxD, joinD) {
    for (let i = 1; i <= count; i++) {
        const nickname = `${baseName}_${i}`;
        createBot(pin, nickname, autoAnswer, minD, maxD, joinD);
        await new Promise(r => setTimeout(r, joinD || 60));
    }
}

function createBot(pin, nickname, autoAnswer, minD, maxD, joinD) {
    const client = new Kahoot();

    client.join(pin, nickname).catch((err) => {
        console.log(`[BŁĄD] Bot ${nickname} nie mógł dołączyć: ${err.description || err}`);
        if (globalRejoin) {
            setTimeout(() => {
                createBot(pin, nickname + "x", autoAnswer, minD, maxD, joinD);
            }, 2500);
        }
    });

    client.on("Disconnect", (reason) => {
        if (globalRejoin) {
            console.log(`[REJOIN] Bot ${nickname} wyrzucony (${reason}). Wraca...`);
            setTimeout(() => {
                createBot(pin, nickname, autoAnswer, minD, maxD, joinD);
            }, 2500);
        }
    });

    if (autoAnswer) {
        client.on("QuestionStart", (q) => {
            const delay = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
            setTimeout(() => {
                q.answer(Math.floor(Math.random() * 4)).catch(()=>{});
            }, delay);
        });
    }
    
    activeClients.push(client);
}

const port = process.env.PORT || 3000;
app.listen(port, () => { 
    console.log(`Serwer działa na porcie ${port}`); 
});


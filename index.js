const express = require('express');
const Kahoot = require("kahoot.js-latest");
const app = express();

app.use(express.json());
app.get('/', (req, res) => {
    res.send("OK");
});

let activeClients = [];
let globalRejoin = false; // Sterowane z Godota

app.post('/atak', (req, res) => {
    const { pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay, rejoin } = req.body;
    
    console.log(`[ATAK] PIN: ${pin}, Rejoin: ${rejoin}`);
    
    globalRejoin = rejoin; // Ustawiamy tryb niezniszczalności
    activeClients = []; // Resetujemy listę (ale stare procesy zostaną nadpisane)
    
    spawnBots(pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay);
    res.send({ status: "Atak rozpoczęty!" });
});

app.post('/2fa', (req, res) => {
    const { code } = req.body;
    const digitCode = code.split('').map(Number);
    activeClients.forEach(client => {
        for(let i=0; i<3; i++) {
            setTimeout(() => { client.answer2FA(digitCode).catch(()=>{}); }, i * 500);
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

    client.join(pin, nickname).catch(() => {});

    client.on("Disconnect", (reason) => {
        if (globalRejoin) {
            console.log(`[REJOIN] Bot ${nickname} wyrzucony. Wraca za 1s...`);
            setTimeout(() => {
                createBot(pin, nickname, autoAnswer, minD, maxD, joinD);
            }, 1000);
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
app.listen(port, () => { console.log(`Serwer na porcie ${port}`); });


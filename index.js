const express = require('express');
const Kahoot = require("kahoot.js-latest");
const app = express();

app.use(express.json());

// Endpoint dla przycisku "Budź"
app.get('/', (req, res) => {
    res.send("OK - Serwer działa. Aktywnych botów: " + activeClients.length);
});

let activeClients = [];
let globalRejoin = false; 

// --- 1. STARTOWANIE BOTÓW ---
app.post('/atak', (req, res) => {
    const { pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay, rejoin, smartAnswer } = req.body;
    console.log(`[ATAK] PIN: ${pin}, Rejoin: ${rejoin}, Smart: ${smartAnswer}`);
    
    globalRejoin = rejoin; 
    activeClients = []; // Resetujemy listę przy nowym ataku
    
    spawnBots(pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay, smartAnswer);
    res.send({ status: "Atak rozpoczęty!" });
});

// --- 2. OBSŁUGA 2FA ---
app.post('/2fa', (req, res) => {
    const { code } = req.body;
    if (!code) return res.send({ status: "Błąd: brak kodu" });

    const digitCode = code.split('').map(Number);
    activeClients.forEach(client => {
        // Kahoot czasem wymaga powtórzenia kodu przy lagach
        for(let i=0; i<2; i++) {
            setTimeout(() => { 
                if(client && client.answer2FA) {
                    client.answer2FA(digitCode).catch(() => {});
                }
            }, i * 1000);
        }
    });
    res.send({ status: "Kod wysłany" });
});

// --- 3. PRZYCISK STOP (PANIC BUTTON) ---
app.post('/stop', (req, res) => {
    console.log("[STOP] Wyłączanie wszystkich botów...");
    globalRejoin = false; 
    activeClients.forEach(client => {
        try { 
            client.leave(); // Grzeczne wyjście z gry (czyści raport)
        } catch(e) {}
    });
    activeClients = [];
    res.send({ status: "Zatrzymano wszystko" });
});

async function spawnBots(pin, baseName, count, autoAnswer, minD, maxD, joinD, smart) {
    for (let i = 1; i <= count; i++) {
        const nickname = count === 1 ? baseName : `${baseName}_${i}`;
        createBot(pin, nickname, autoAnswer, minD, maxD, joinD, smart);
        // Zwiększony minimalny delay dołączania, żeby nie dostać bana za spam
        await new Promise(r => setTimeout(r, joinD || 250));
    }
}

function createBot(pin, nickname, autoAnswer, minD, maxD, joinD, smart) {
    const client = new Kahoot();

    client.join(pin, nickname).then(() => {
        // DODAJEMY DO LISTY TYLKO GDY DOŁĄCZYŁ (zapobiega duchom w raporcie)
        activeClients.push(client);
        console.log(`[JOIN] ${nickname} dołączył`);
    }).catch((err) => {
        console.log(`[ERR] ${nickname} nie mógł wejść: ${err}`);
        if (globalRejoin) {
            setTimeout(() => createBot(pin, nickname + "x", autoAnswer, minD, maxD, joinD, smart), 3000);
        }
    });

    client.on("Disconnect", (reason) => {
        // Usuwamy bota z listy, jeśli sam wyleci
        activeClients = activeClients.filter(c => c !== client);
        if (globalRejoin) {
            setTimeout(() => createBot(pin, nickname + "x", autoAnswer, minD, maxD, joinD, smart), 3000);
        }
    });

    if (autoAnswer) {
        client.on("QuestionStart", (q) => {
            const delay = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
            setTimeout(() => {
                let choice;
                if (smart && q.quizQuestionAnswers && q.quizQuestionAnswers[q.questionIndex] !== undefined) {
                    choice = q.quizQuestionAnswers[q.questionIndex];
                } else {
                    choice = Math.floor(Math.random() * q.quizQuestionAnswersCount || 4);
                }
                q.answer(choice).catch(() => {});
            }, delay);
        });
    }
}

const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`Serwer działa na porcie ${port}`); });


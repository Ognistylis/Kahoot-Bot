const express = require('express');
const Kahoot = require("kahoot.js-latest");
const app = express();

app.use(express.json());

// Tu trzymamy aktywne boty
let activeClients = [];

// --- 1. STARTOWANIE BOTÓW ---
app.post('/atak', (req, res) => {
    // Odbieramy dane z Godota (telefonu)
    const { pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay } = req.body;
    
    console.log(`[ROZKAZ] PIN: ${pin}, Ilość: ${count}, Auto: ${autoAnswer}`);
    
    // Resetujemy starą armię
    activeClients = [];
    
    // Odpalamy funkcję tworzenia botów w tle
    spawnBots(pin, name, count, autoAnswer, minDelay, maxDelay, joinDelay);
    
    res.send({ status: "Atak rozpoczęty!" });
});

// --- 2. OBSŁUGA 2FA (KOLORY) ---
app.post('/2fa', (req, res) => {
    const { code } = req.body; // np. "0123"
    const digitCode = code.split('').map(Number);
    
    console.log(`[2FA] Wysyłam kod: ${digitCode}`);
    
    // Wysyłamy kod do każdego aktywnego bota
    activeClients.forEach(client => {
        try {
            // Próbujemy 3 razy dla pewności
            for(let i=0; i<3; i++) {
                setTimeout(() => {
                     client.answer2FA(digitCode);
                }, i * 500);
            }
        } catch(e) {}
    });
    
    res.send({ status: "Kod wysłany" });
});

async function spawnBots(pin, baseName, count, autoAnswer, minD, maxD, joinD) {
    for (let i = 1; i <= count; i++) {
        const client = new Kahoot();
        const nickname = `${baseName}_${i}`;
        
        // Czekamy tyle, ile ustawisz w Godocie (opcja "Join Delay")
        await new Promise(r => setTimeout(r, joinD || 60));

        try {
            client.join(pin, nickname).catch(() => {});
            
            // Konfiguracja odpowiadania
            if (autoAnswer) {
                client.on("QuestionStart", (q) => {
                    const delay = Math.floor(Math.random() * ((maxD || 1000) - (minD || 0) + 1)) + (minD || 0);
                    setTimeout(() => {
                        const ans = Math.floor(Math.random() * 4);
                        q.answer(ans).catch(()=>{});
                    }, delay);
                });
            }
            activeClients.push(client);
        } catch(e) {}
    }
    console.log(`[INFO] Wysłano ${count} botów.`);
}

// Uruchomienie serwera
app.listen(3000, () => {
    console.log("SERWER DZIAŁA! Skopiuj link z okna Webview.");

});

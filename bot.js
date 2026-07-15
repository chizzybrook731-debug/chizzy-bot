const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((res) => rl.question(text, res))

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    })

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Enter your WhatsApp number with country code: 26377XXXXXXX \n')
        const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''))
        console.log('Your Pairing Code:', code?.match(/.{1,4}/g)?.join('-'))
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'open') {
            console.log('Bot Connected! 🔥')
            rl.close()
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text
        
        if (text === '.ping') {
            await sock.sendMessage(msg.key.remoteJid, { text: 'pong! Chizzy Bot is online 💪' })
        }
        if (text === '.menu') {
            await sock.sendMessage(msg.key.remoteJid, { text: `*CHIZZY BOT MENU*\n.ping - test bot\n.menu - show this` })
        }
    })

    sock.ev.on('creds.update', saveCreds)
}
startBot()

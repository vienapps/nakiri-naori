const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const pino = require("pino");
const { handleMessages } = require("./src/handlingMessage");
const useCd = process.argv.includes("--code");
const Boom = require('@hapi/boom');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const Naori = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: !useCd, 
    auth: state,
    browser: useCd ? ["Chrome (Linux)", "", ""] : ["Naori", "Firefox", '1.0.0'],
  });

  if (useCd && !Naori.authState.creds.registered) {
    const question = () => new Promise((resolve) => {
      const readLine = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      readLine.question("Input Your Whatsapp Phone Number: +", (answer) => {
        resolve(answer);
        readLine.close();
      });
    });

    const phoneNumber = await question();
    setTimeout(async function() {
      const codePair = await Naori.requestPairingCode(phoneNumber);
      console.log("Connect With Pairing Code : " + codePair);
    }, 3000);
  }

  Naori.ev.on('connection.update', async ({ connection }) => {
    if (connection === "open") {
      console.log("Connected: " + Naori.user.id.split(":")[0]);
    } else if (connection === "close") {
      try { 
        await start();
      } catch (error){
        throw Boom.badImplementation('Error : ', error);
      }
    }
  });

  Naori.ev.on('messages.upsert', ({ messages }) => {
    if (messages && messages.length > 0) {
      const m = messages[0];
      if (m && m.message && m.message.conversation) {
        handleMessages(Naori, m);
      }
    }
  });

  Naori.ev.on('creds.update', saveCreds);
}

start();

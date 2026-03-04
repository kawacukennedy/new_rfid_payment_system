const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://broker.benax.rw:1883';
const client = mqtt.connect(BROKER_URL, { clientId: 'MockESP8266_' + Math.random().toString(16).substr(2, 8) });

const TOPIC_PREFIX = 'rfid/kawacukennedy';
const TOPIC_STATUS = `${TOPIC_PREFIX}/card/status`;
const TOPIC_BALANCE = `${TOPIC_PREFIX}/card/balance`;
const TOPIC_TOPUP = `${TOPIC_PREFIX}/card/topup`;
const TOPIC_PAY = `${TOPIC_PREFIX}/card/pay`;

let currentCard = { uid: "MOCK-1A2B3C4D", balance: 0 };

client.on('connect', () => {
    console.log('[Mock ESP8266] Connected to MQTT broker');
    client.subscribe(TOPIC_TOPUP);
    client.subscribe(TOPIC_PAY);

    console.log(`\n--- MOCK ESP8266 COMMANDS ---`);
    console.log(`Type 'tap' to simulate scanning card ${currentCard.uid}`);
    console.log(`Type 'switch' to cycle to another mock card UID`);
    console.log(`Type 'exit' to quit\n`);
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());

        if (topic === TOPIC_TOPUP) {
            console.log(`[Mock ESP8266] Received Top-Up Command:`, payload);
            if (payload.uid === currentCard.uid) {
                currentCard.balance += payload.amount;

                // Simulate processing delay
                setTimeout(() => {
                    const response = {
                        uid: currentCard.uid,
                        balance: currentCard.balance,
                        lastAmount: payload.amount,
                        lastType: 'TOPUP'
                    };
                    client.publish(TOPIC_BALANCE, JSON.stringify(response));
                    console.log(`[Mock ESP8266] Processed Top-Up. New Local Balance: ${currentCard.balance}`);
                }, 500);
            }
        }
        else if (topic === TOPIC_PAY) {
            console.log(`[Mock ESP8266] Received Pay Command:`, payload);
            if (payload.uid === currentCard.uid) {
                currentCard.balance -= payload.amount;
                if (currentCard.balance < 0) currentCard.balance = 0;

                // Simulate processing delay
                setTimeout(() => {
                    const response = {
                        uid: currentCard.uid,
                        balance: currentCard.balance,
                        lastAmount: payload.amount,
                        lastType: 'PAYMENT'
                    };
                    client.publish(TOPIC_BALANCE, JSON.stringify(response));
                    console.log(`[Mock ESP8266] Processed Payment. New Local Balance: ${currentCard.balance}`);
                }, 500);
            }
        }
    } catch (e) {
        console.error("Error processing MQTT message in Mock:", e);
    }
});

// Setup simple CLI to trigger taps
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const mockUids = ["MOCK-1A2B3C4D", "MOCK-9Z8Y7X6W", "MOCK-5F4E3D2C"];
let mockIndex = 0;

readline.on('line', (input) => {
    const cmd = input.trim().toLowerCase();

    if (cmd === 'tap') {
        const statusMsg = { uid: currentCard.uid, balance: currentCard.balance };
        client.publish(TOPIC_STATUS, JSON.stringify(statusMsg));
        console.log(`[Mock ESP8266] Tapped card ${currentCard.uid}. Emitted status to ${TOPIC_STATUS}`);
    }
    else if (cmd === 'switch') {
        mockIndex = (mockIndex + 1) % mockUids.length;
        currentCard = { uid: mockUids[mockIndex], balance: 0 };
        console.log(`[Mock ESP8266] Switched active card to ${currentCard.uid} (Assumed balance 0 for mock state)`);
    }
    else if (cmd === 'exit' || cmd === 'quit') {
        console.log("[Mock ESP8266] Exiting...");
        process.exit(0);
    }
});

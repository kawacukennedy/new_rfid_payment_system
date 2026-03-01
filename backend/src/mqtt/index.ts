import mqtt from 'mqtt';
import { getCard, ensureCardExists } from '../db';
import { broadcastBalanceUpdate } from '../websocket';

const BROKER_URL = 'mqtt://broker.hivemq.com:1883'; // Using unencrypted for simplicity if needed, but tls usually mqtts://

const client = mqtt.connect(BROKER_URL, {
    reconnectPeriod: 1000,
});

const TOPIC_PREFIX = 'rfid/kawacukennedy';
const TOPIC_STATUS = `${TOPIC_PREFIX}/card/status`;
const TOPIC_BALANCE = `${TOPIC_PREFIX}/card/balance`;

client.on('connect', () => {
    console.log('Connected to MQTT broker via MQTT');
    client.subscribe(TOPIC_STATUS, { qos: 1 }, (err) => {
        if (!err) console.log(`Subscribed to ${TOPIC_STATUS}`);
    });
    client.subscribe(TOPIC_BALANCE, { qos: 1 }, (err) => {
        if (!err) console.log(`Subscribed to ${TOPIC_BALANCE}`);
    });
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());

        if (topic === TOPIC_STATUS) {
            // { uid: string, balance: integer } 
            // Emitted when card is tapped on ESP8266
            const { uid, balance } = payload;
            console.log(`[MQTT Status] Card Tapped - UID: ${uid}, Balance reported: ${balance}`);

            const dbCard = getCard(uid);
            if (!dbCard) {
                console.log(`[MQTT] Creating previously unseen card: ${uid}`);
                ensureCardExists(uid);
            }

            // Alert dashboard that a card was tapped (for auto-filling UID inputs)
            broadcastBalanceUpdate({
                uid,
                newBalance: dbCard ? dbCard.balance : 0,
                previousBalance: dbCard ? dbCard.balance : 0,
                transactionType: 'TAP', // Custom type to indicate merely tapping
                amount: 0
            });
        }
        else if (topic === TOPIC_BALANCE) {
            // Emitted after ESP8266 updates balance locally from a command
            const { uid, balance, lastAmount, lastType } = payload;
            console.log(`[MQTT Balance] ESP8266 synced - UID: ${uid}, Local Balance: ${balance}`);
        }
    } catch (error) {
        console.error('MQTT Message handling error:', error);
    }
});

client.on('error', (err) => {
    console.error('MQTT Client Error:', err);
});

export const publishMessage = (topic: string, message: string) => {
    if (client.connected) {
        client.publish(topic, message, { qos: 1 });
        console.log(`[MQTT Publish] ${topic} -> ${message}`);
    } else {
        console.warn(`[MQTT Publish] Failed, client offline (Queueing handled by mqtt lib if setup)`);
    }
};

import mqtt from 'mqtt';
import { getCard, ensureCardExists } from '../db';
import { broadcastBalanceUpdate } from '../websocket';

const BROKER_URL = process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883';
const USE_TLS = process.env.MQTT_USE_TLS === 'true';

let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

const client = mqtt.connect(BROKER_URL, {
    reconnectPeriod: 1000,
    ...(USE_TLS && {
        tls: {
            rejectUnauthorized: true
        }
    })
});

const TOPIC_PREFIX = 'rfid/kawacukennedy';
const TOPIC_STATUS = `${TOPIC_PREFIX}/card/status`;
const TOPIC_BALANCE = `${TOPIC_PREFIX}/card/balance`;

const getReconnectDelay = (attempt: number): number => {
    const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
    return delay + Math.random() * 1000;
};

client.on('connect', () => {
    console.log('Connected to MQTT broker via MQTT');
    reconnectAttempts = 0;
    client.subscribe(TOPIC_STATUS, { qos: 1 }, (err) => {
        if (!err) console.log(`Subscribed to ${TOPIC_STATUS}`);
    });
    client.subscribe(TOPIC_BALANCE, { qos: 1 }, (err) => {
        if (!err) console.log(`Subscribed to ${TOPIC_BALANCE}`);
    });
});

client.on('reconnect', () => {
    const delay = getReconnectDelay(reconnectAttempts);
    reconnectAttempts++;
    console.log(`MQTT Reconnecting in ${Math.round(delay/1000)}s (attempt ${reconnectAttempts})`);
});

client.on('offline', () => {
    console.warn('MQTT Client is offline');
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());

        if (topic === TOPIC_STATUS) {
            const { uid, balance } = payload;
            console.log(`[MQTT Status] Card Tapped - UID: ${uid}, Balance reported: ${balance}`);

            const dbCard = getCard(uid);
            if (!dbCard) {
                console.log(`[MQTT] Creating previously unseen card: ${uid}`);
                ensureCardExists(uid);
            }

            broadcastBalanceUpdate({
                uid,
                newBalance: dbCard ? dbCard.balance : 0,
                previousBalance: dbCard ? dbCard.balance : 0,
                transactionType: 'TAP',
                amount: 0
            });
        }
        else if (topic === TOPIC_BALANCE) {
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
        console.warn(`[MQTT Publish] Failed, client offline`);
    }
};

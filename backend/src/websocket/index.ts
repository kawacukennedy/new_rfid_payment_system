import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer;
let heartbeatInterval: NodeJS.Timeout;

export const initWebSocket = (server: Server) => {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected to WebSocket');

        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });

        ws.on('error', (error) => {
            console.error('WebSocket Error:', error);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (e) {
                console.error('WS message parse error:', e);
            }
        });
    });

    heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if ((ws as any).isAlive === false) {
                return ws.terminate();
            }
            (ws as any).isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    });
};

export interface BalanceUpdatePayload {
    uid: string;
    newBalance: number;
    previousBalance: number;
    transactionType: 'TOPUP' | 'PAYMENT' | 'TAP';
    amount: number;
}

export const broadcastBalanceUpdate = (payload: BalanceUpdatePayload) => {
    if (!wss) return;
    const message = JSON.stringify({ event: 'BALANCE_UPDATE', payload });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

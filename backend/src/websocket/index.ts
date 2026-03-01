import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

let wss: WebSocketServer;

export const initWebSocket = (server: Server) => {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected to WebSocket');

        // Heartbeat mechanism could be implemented here

        ws.on('close', () => {
            console.log('Client disconnected');
        });

        ws.on('error', (error) => {
            console.error('WebSocket Error:', error);
        })
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

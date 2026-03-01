import request from 'supertest';
import express from 'express';
import apiRoutes from '../src/http';

import { db, topUpCard } from '../src/db';

// Mock MQTT and WebSocket so we don't connect to actual external services
jest.mock('../src/mqtt', () => ({
    publishMessage: jest.fn(),
}));

jest.mock('../src/websocket', () => ({
    broadcastBalanceUpdate: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/', apiRoutes);

describe('HTTP API Endpoints', () => {
    beforeAll(() => {
        db.prepare('DELETE FROM transactions').run();
        db.prepare('DELETE FROM cards').run();
    });

    describe('GET /products', () => {
        it('should return a list of available products', async () => {
            const res = await request(app).get('/products');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBeGreaterThan(0);
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('price');
        });
    });

    describe('POST /topup', () => {
        it('should accept a valid top-up request', async () => {
            const res = await request(app).post('/topup').send({
                uid: 'API-UID-1',
                amount: 500,
            });

            expect(res.status).toBe(202);
            expect(res.body.status).toBe('processing');
            expect(res.body.newBalance).toBe(500);
        });

        it('should reject invalid top-up request', async () => {
            const res = await request(app).post('/topup').send({
                uid: '',
                amount: -100,
            });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid input');
        });
    });

    describe('POST /pay', () => {
        beforeAll(() => {
            topUpCard('API-UID-2', 1000);
        });

        it('should accept a valid payment with sufficient balance', async () => {
            const res = await request(app).post('/pay').send({
                uid: 'API-UID-2',
                productId: 1, // coffee 250
                quantity: 2, // 500 total
            });

            expect(res.status).toBe(202);
            expect(res.body.status).toBe('processing');
            expect(res.body.newBalance).toBe(500); // 1000 - 500
        });

        it('should return 402 for insufficient balance', async () => {
            const res = await request(app).post('/pay').send({
                uid: 'API-UID-2',
                productId: 2, // sandwich 500
                quantity: 3, // 1500 total, only have 500
            });

            expect(res.status).toBe(402);
            expect(res.body.error).toBe('Insufficient balance');
        });

        it('should return 404 for non-existent card or product', async () => {
            const res = await request(app).post('/pay').send({
                uid: 'API-UID-UNKNOWN',
                productId: 1,
                quantity: 1,
            });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Card not found');
        });
    });
});

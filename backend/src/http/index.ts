import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { topUpCard, processPayment, getProducts } from '../db';
import { publishMessage } from '../mqtt';
import { broadcastBalanceUpdate } from '../websocket';

const router = Router();

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.use(limiter);

const TopUpSchema = z.object({
    uid: z.string().min(1),
    amount: z.number().int().positive()
});

const PaymentSchema = z.object({
    uid: z.string().min(1),
    productId: z.number().int().positive(),
    quantity: z.number().int().positive()
});

router.post('/topup', (req, res) => {
    try {
        const { uid, amount } = TopUpSchema.parse(req.body);

        // We execute the DB atomicity here
        // And if successful, publish to MQTT
        // ESP8266 will apply it

        const { newBalance, transactionId } = topUpCard(uid, amount);

        // Broadcast via MQTT
        publishMessage(`rfid/kawacukennedy/card/topup`, JSON.stringify({ uid, amount }));

        // Broadcast via WS
        broadcastBalanceUpdate({
            uid,
            newBalance,
            previousBalance: newBalance - amount,
            transactionType: 'TOPUP',
            amount
        });

        res.status(202).json({ status: 'processing', newBalance, transactionId: transactionId.toString() });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        console.error("Topup error:", error);
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/pay', (req, res) => {
    try {
        const { uid, productId, quantity } = PaymentSchema.parse(req.body);

        // Execute DB atomic transaction
        const { newBalance, transactionId } = processPayment(uid, productId, quantity);

        const product = getProducts().find(p => p.id === productId);
        const totalCost = (product?.price || 0) * quantity;

        // Publish MQTT
        publishMessage(`rfid/kawacukennedy/card/pay`, JSON.stringify({ uid, amount: totalCost }));

        // Broadcast via WS
        broadcastBalanceUpdate({
            uid,
            newBalance,
            previousBalance: newBalance + totalCost,
            transactionType: 'PAYMENT',
            amount: totalCost
        });

        res.status(202).json({ status: 'processing', newBalance, transactionId: transactionId.toString() });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
        }
        const msg = (error as Error).message;
        console.error("Payment error:", msg);

        if (msg === "Insufficient balance") {
            return res.status(402).json({ error: msg });
        }
        if (msg === "Card not found" || msg === "Product not found") {
            return res.status(404).json({ error: msg });
        }
        res.status(500).json({ error: msg });
    }
});

router.get('/products', (req, res) => {
    try {
        const products = getProducts();
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

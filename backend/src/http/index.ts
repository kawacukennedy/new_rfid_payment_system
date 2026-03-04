import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { topUpCard, processPayment, getProducts, findUserByUsername, createUser, saveReceipt, getReceiptByTransactionId } from '../db';
import { publishMessage } from '../mqtt';
import { broadcastBalanceUpdate } from '../websocket';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

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

const RegisterSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    role: z.enum(['admin', 'staff']).default('staff')
});

const LoginSchema = z.object({
    username: z.string(),
    password: z.string()
});

router.use(limiter);

// --- Auth Routes ---
router.post('/auth/register', (req, res) => {
    try {
        const { username, password, role } = RegisterSchema.parse(req.body);
        if (findUserByUsername(username)) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        const passwordHash = bcrypt.hashSync(password, 10);
        const user = createUser(username, passwordHash, role);
        res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: error.issues });
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/auth/login', (req, res) => {
    try {
        const { username, password } = LoginSchema.parse(req.body);
        const user = findUserByUsername(username);
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: error.issues });
        res.status(500).json({ error: (error as Error).message });
    }
});

// --- Protected Routes ---
router.post('/topup', authenticateToken, (req, res) => {
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

router.post('/pay', authenticateToken, (req, res) => {
    try {
        const { uid, productId, quantity } = PaymentSchema.parse(req.body);

        // Execute DB atomic transaction
        const { newBalance, transactionId } = processPayment(uid, productId, quantity);

        const product = getProducts().find(p => p.id === productId);
        const totalCost = (product?.price || 0) * quantity;

        // Generate and save receipt
        const receiptData = {
            transactionId: transactionId.toString(),
            uid,
            productName: product?.name || 'Unknown',
            price: product?.price || 0,
            quantity,
            totalCost,
            balanceAfter: newBalance,
            timestamp: new Date().toISOString(),
            merchant: "RFID Wallet System"
        };
        saveReceipt(transactionId as number, receiptData);

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

        res.status(202).json({
            status: 'processing',
            newBalance,
            transactionId: transactionId.toString(),
            receipt: receiptData
        });
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

router.get('/receipt/:transactionId', (req, res) => {
    try {
        const txId = parseInt(req.params.transactionId);
        const receipt = getReceiptByTransactionId(txId);
        if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
        res.status(200).json(JSON.parse(receipt.receipt_data));
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

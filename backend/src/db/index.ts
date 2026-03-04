import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
}

export const db = new Database(path.join(dbPath, 'wallet.db'), { verbose: console.log });

// Initialize schema on startup
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// DAO interfaces
export interface Card {
    uid: string;
    balance: number;
    created_at: string;
}

export interface Product {
    id: number;
    name: string;
    price: number;
}

export interface Transaction {
    id: number;
    uid: string;
    type: 'TOPUP' | 'PAYMENT';
    amount: number;
    balance_after: number;
    product_id: number | null;
    quantity: number | null;
    created_at: string;
}

export interface User {
    id: number;
    username: string;
    password_hash: string;
    role: string;
    created_at: string;
}

export interface Receipt {
    id: number;
    transaction_id: number;
    receipt_data: string; // JSON string
    created_at: string;
}

// Queries
getCard: db.prepare('SELECT * FROM cards WHERE uid = ?'),
    createCard: db.prepare('INSERT INTO cards (uid, balance) VALUES (?, ?) RETURNING *'),
        getProducts: db.prepare('SELECT * FROM products'),
            getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
                // Auth
                getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
                    createUser: db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) RETURNING *'),
                        // Receipts
                        getReceiptByTx: db.prepare('SELECT * FROM receipts WHERE transaction_id = ?'),
                            createReceipt: db.prepare('INSERT INTO receipts (transaction_id, receipt_data) VALUES (?, ?) RETURNING *'),
};

export const getCard = (uid: string): Card | undefined => {
    return queries.getCard.get(uid) as Card | undefined;
};

export const ensureCardExists = (uid: string): Card => {
    const card = getCard(uid);
    if (card) return card;
    const newCard = queries.createCard.get(uid, 0) as Card;
    return newCard;
};

export const getProducts = (): Product[] => {
    return queries.getProducts.all() as Product[];
}

export const getProductById = (id: number): Product | undefined => {
    return queries.getProductById.get(id) as Product | undefined;
}

// Transactions require atomicity
export const topUpCard = db.transaction((uid: string, amount: number): { newBalance: number, transactionId: number | bigint } => {
    if (amount <= 0) throw new Error("Amount must be greater than 0");
    const card = ensureCardExists(uid);

    const newBalance = card.balance + amount;

    // Update balance
    db.prepare('UPDATE cards SET balance = ? WHERE uid = ?').run(newBalance, uid);

    // Record transaction
    const stmt = db.prepare(`
    INSERT INTO transactions (uid, type, amount, balance_after, product_id, quantity)
    VALUES (?, 'TOPUP', ?, ?, NULL, NULL)
  `);
    const info = stmt.run(uid, amount, newBalance);

    return { newBalance, transactionId: info.lastInsertRowid };
});

export const processPayment = db.transaction((uid: string, productId: number, quantity: number): { newBalance: number, transactionId: number | bigint } => {
    if (quantity <= 0) throw new Error("Quantity must be greater than 0");

    const card = getCard(uid);
    if (!card) throw new Error("Card not found");

    const product = getProductById(productId);
    if (!product) throw new Error("Product not found");

    const totalCost = product.price * quantity;

    if (card.balance < totalCost) {
        throw new Error("Insufficient balance");
    }

    const newBalance = card.balance - totalCost;

    // Update balance
    db.prepare('UPDATE cards SET balance = ? WHERE uid = ?').run(newBalance, uid);

    // Record transaction
    const stmt = db.prepare(`
    INSERT INTO transactions (uid, type, amount, balance_after, product_id, quantity)
    VALUES (?, 'PAYMENT', ?, ?, ?, ?)
  `);
    const info = stmt.run(uid, totalCost, newBalance, productId, quantity);

    return { newBalance, transactionId: info.lastInsertRowid };
});

// Auth Helpers
export const findUserByUsername = (username: string): User | undefined => {
    return queries.getUserByUsername.get(username) as User | undefined;
};

export const createUser = (username: string, passwordHash: string, role: string = 'staff'): User => {
    return queries.createUser.get(username, passwordHash, role) as User;
};

// Receipt Helpers
export const saveReceipt = (transactionId: number | bigint, receiptData: object): Receipt => {
    return queries.createReceipt.get(transactionId, JSON.stringify(receiptData)) as Receipt;
};

export const getReceiptByTransactionId = (transactionId: number | bigint): Receipt | undefined => {
    return queries.getReceiptByTx.get(transactionId) as Receipt | undefined;
};


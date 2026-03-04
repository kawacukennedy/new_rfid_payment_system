-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS cards (
    uid TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    type TEXT CHECK(type IN ('TOPUP', 'PAYMENT')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    product_id INTEGER,
    quantity INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uid) REFERENCES cards(uid),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_uid ON cards(uid);
CREATE INDEX IF NOT EXISTS idx_transactions_uid ON transactions(uid);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Insert dummy products if not exists
INSERT INTO products (id, name, price) SELECT 1, 'Coffee', 250 WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 1);
INSERT INTO products (id, name, price) SELECT 2, 'Sandwich', 500 WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 2);
INSERT INTO products (id, name, price) SELECT 3, 'Water Bottle', 150 WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 3);

-- Authentication System
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'staff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Receipt Tracking (Deep JSON storage for receipt state)
CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL UNIQUE,
    receipt_data TEXT NOT NULL, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipts(transaction_id);

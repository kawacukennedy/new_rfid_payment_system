import { ensureCardExists, getCard, getProducts, getProductById, topUpCard, processPayment, db } from '../src/db';

describe('Database Layer', () => {
    beforeAll(() => {
        // Note: The db is initialized and schema applied upon import
        // Clear out any cards or transactions created during previous test runs based on this db file
        db.prepare('DELETE FROM transactions').run();
        db.prepare('DELETE FROM cards').run();
    });

    afterAll(() => {
        // Optionally close DB
    });

    it('should ensure a card exists when requested', () => {
        const card = ensureCardExists('TEST-UID-1');
        expect(card).toBeDefined();
        expect(card.uid).toBe('TEST-UID-1');
        expect(card.balance).toBe(0);

        const fetchedCard = getCard('TEST-UID-1');
        expect(fetchedCard?.uid).toBe('TEST-UID-1');
    });

    it('should get all default products', () => {
        const products = getProducts();
        expect(products.length).toBeGreaterThanOrEqual(3); // Expecting Coffee, Sandwich, Water Bottle
        expect(products.map((p) => p.name)).toContain('Coffee');
    });

    it('should get product by id', () => {
        const product = getProductById(1);
        expect(product).toBeDefined();
        expect(product?.name).toBe('Coffee');
        expect(product?.price).toBe(250);
    });

    it('should top up a card balance atomically', () => {
        const { newBalance, transactionId } = topUpCard('TEST-UID-2', 1000);
        expect(newBalance).toBe(1000);
        expect(transactionId).toBeDefined();

        const fetchedCard = getCard('TEST-UID-2');
        expect(fetchedCard?.balance).toBe(1000);

        // Verify transaction log
        const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as any;
        expect(tx.type).toBe('TOPUP');
        expect(tx.amount).toBe(1000);
        expect(tx.uid).toBe('TEST-UID-2');
    });

    it('should process payment if balance is sufficient', () => {
        ensureCardExists('TEST-UID-3');
        topUpCard('TEST-UID-3', 1000);

        // Coffee costs 250
        const { newBalance, transactionId } = processPayment('TEST-UID-3', 1, 2);
        expect(newBalance).toBe(500); // 1000 - (250 * 2)
        expect(transactionId).toBeDefined();

        const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as any;
        expect(tx.type).toBe('PAYMENT');
        expect(tx.amount).toBe(500);
        expect(tx.uid).toBe('TEST-UID-3');
    });

    it('should fail payment if balance is insufficient', () => {
        ensureCardExists('TEST-UID-4'); // Balance is 0
        expect(() => {
            processPayment('TEST-UID-4', 1, 1);
        }).toThrow('Insufficient balance');

        // Balance should remain unchanged
        const card = getCard('TEST-UID-4');
        expect(card?.balance).toBe(0);
    });
});

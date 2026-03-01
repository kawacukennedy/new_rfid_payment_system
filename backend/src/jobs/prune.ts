import cron from 'node-cron';
import { db } from '../db';

export const initPruningJob = () => {
    // Schedule to run every Sunday at midnight (0 0 * * 0)
    cron.schedule('0 0 * * 0', () => {
        console.log('[Background Job] Starting transaction log pruning...');
        try {
            // Delete transactions older than 1 year
            const stmt = db.prepare(`DELETE FROM transactions WHERE created_at < datetime('now', '-1 year')`);
            const info = stmt.run();
            console.log(`[Background Job] Pruning complete. Deleted ${info.changes} old transactions.`);
        } catch (error) {
            console.error('[Background Job] Failed to prune transactions:', error);
        }
    });

    console.log('Background job: Transaction log pruning scheduled (Weekly).');
};

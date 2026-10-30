import cron from 'node-cron';
import db from '../db/db.ts';

export function initExpiryJob() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily expiry check...');
    const today = new Date().toISOString().split('T')[0];
    
    const stmt = db.prepare(`
      UPDATE items 
      SET status = 'expired' 
      WHERE status = 'active' AND expiry_date < ?
    `);
    
    const info = stmt.run(today);
    console.log(`Updated ${info.changes} items to 'expired'.`);
  });
}

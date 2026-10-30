import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'freshkeep.db');
const db = new Database(dbPath);

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('dairy', 'vegetables', 'meat', 'grains', 'other')),
      quantity INTEGER NOT NULL DEFAULT 1,
      expiry_date TEXT NOT NULL, -- YYYY-MM-DD
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      cook_time TEXT,
      ingredients TEXT, -- JSON string
      steps TEXT, -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Seed data
export function seedDb() {
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number };
  if (rowCount.count === 0) {
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const sampleItems = [
      { name: 'Milk', category: 'dairy', quantity: 1, expiry_date: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)), status: 'active' },
      { name: 'Spinach', category: 'vegetables', quantity: 2, expiry_date: formatDate(new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)), status: 'active' }, // Overdue
      { name: 'Chicken Breast', category: 'meat', quantity: 1, expiry_date: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)), status: 'active' },
      { name: 'Yogurt', category: 'dairy', quantity: 3, expiry_date: formatDate(new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)), status: 'active' },
      { name: 'Bread', category: 'grains', quantity: 1, expiry_date: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)), status: 'active' },
      { name: 'Eggs', category: 'dairy', quantity: 12, expiry_date: formatDate(new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000)), status: 'active' },
      { name: 'Apples', category: 'other', quantity: 5, expiry_date: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)), status: 'active' },
      { name: 'Carrots', category: 'vegetables', quantity: 10, expiry_date: formatDate(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)), status: 'active' },
    ];

    const insert = db.prepare('INSERT INTO items (name, category, quantity, expiry_date, status) VALUES (?, ?, ?, ?, ?)');
    for (const item of sampleItems) {
      insert.run(item.name, item.category, item.quantity, item.expiry_date, item.status);
    }
    console.log('Database seeded with sample items.');
  }
}

export default db;

import { Request, Response } from 'express';
import db from '../db/db.ts';
import { calculateDaysLeft, getFreshnessLabel } from '../utils/helpers.ts';

export const addItem = (req: Request, res: Response) => {
  const { name, category, quantity, expiry_date, status } = req.body;

  if (!name || !category || !quantity) {
    return res.status(400).json({ error: "Name, category, and quantity are required" });
  }

  const validCategories = ['dairy', 'vegetables', 'meat', 'grains', 'other'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  if (quantity < 1) {
    return res.status(400).json({ error: "Quantity must be at least 1" });
  }

  try {
    const finalStatus = status || 'active';
    const finalExpiry = expiry_date || new Date().toISOString().split('T')[0];
    const stmt = db.prepare('INSERT INTO items (name, category, quantity, expiry_date, status) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(name, category, quantity, finalExpiry, finalStatus);
    res.status(201).json({ id: info.lastInsertRowid, message: "Item added successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listItems = (req: Request, res: Response) => {
  const { search, category, status } = req.query;
  
  let query = 'SELECT * FROM items WHERE 1=1';
  const params: any[] = [];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY expiry_date ASC';

  try {
    const items = db.prepare(query).all(...params) as any[];
    const processedItems = items.map(item => {
      const daysLeft = calculateDaysLeft(item.expiry_date);
      return {
        ...item,
        daysLeft,
        freshness: getFreshnessLabel(daysLeft)
      };
    });
    res.json(processedItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const editItem = (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, category, quantity, expiry_date, status } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE items 
      SET name = ?, category = ?, quantity = ?, expiry_date = ?, status = ?
      WHERE id = ?
    `);
    const info = stmt.run(name, category, quantity, expiry_date, status || 'active', id);
    if (info.changes === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteItem = (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('DELETE FROM items WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const useItem = (req: Request, res: Response) => {
  const { id } = req.params;
  const used_at = new Date().toISOString();
  try {
    const stmt = db.prepare("UPDATE items SET status = 'used', used_at = ? WHERE id = ?");
    const info = stmt.run(used_at, id);
    if (info.changes === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ message: "Item marked as used" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const restockItem = (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Get the item template
    const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as any;
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Set new expiry (default 7 days from now)
    const newExpiry = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Insert as a new active item
    const stmt = db.prepare('INSERT INTO items (name, category, quantity, expiry_date, status) VALUES (?, ?, ?, ?, ?)');
    stmt.run(item.name, item.category, item.quantity, newExpiry, 'active');

    // Optionally delete the old used record or keep it for history
    // For simplicity, we just add the new one.
    
    res.json({ message: "Item restocked successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkDelete = (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No IDs provided" });
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM items WHERE id IN (${placeholders})`);
    stmt.run(...ids);
    res.json({ message: `${ids.length} items deleted` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkUsed = (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No IDs provided" });
  }

  const used_at = new Date().toISOString();
  try {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`UPDATE items SET status = 'used', used_at = ? WHERE id IN (${placeholders})`);
    stmt.run(used_at, ...ids);
    res.json({ message: `${ids.length} items marked as used` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAlerts = (req: Request, res: Response) => {
  try {
    const threeDaysFromNow = new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const items = db.prepare(`
      SELECT * FROM items 
      WHERE status = 'active' AND expiry_date <= ?
      ORDER BY expiry_date ASC
    `).all(threeDaysFromNow) as any[];

    const processedItems = items.map(item => {
      const daysLeft = calculateDaysLeft(item.expiry_date);
      return { ...item, daysLeft, freshness: getFreshnessLabel(daysLeft) };
    });

    res.json({
      count: processedItems.length,
      items: processedItems
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

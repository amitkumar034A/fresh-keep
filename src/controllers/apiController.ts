import { Request, Response } from 'express';
import db from '../db/db.ts';
import { calculateDaysLeft, getFreshnessLabel, calculateWasteScore } from '../utils/helpers.ts';
import { getRecipeSuggestions, ai, Type } from '../services/gemini.ts';

export const getDashboard = (req: Request, res: Response) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'active'").get() as any;
    
    const today = new Date().toISOString().split('T')[0];
    const threeDaysFromNow = new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const expiringSoon = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'active' AND expiry_date BETWEEN ? AND ?").get(today, threeDaysFromNow) as any;
    const expired = db.prepare("SELECT COUNT(*) as count FROM items WHERE status = 'active' AND expiry_date < ?").get(today) as any;
    
    const useFirst = db.prepare(`
      SELECT * FROM items 
      WHERE status = 'active' 
      ORDER BY expiry_date ASC LIMIT 5
    `).all() as any[];

    const processedUseFirst = useFirst.map(item => ({
      ...item,
      daysLeft: calculateDaysLeft(item.expiry_date),
      freshness: getFreshnessLabel(calculateDaysLeft(item.expiry_date))
    }));

    res.json({
      totalItems: total.count,
      expiringSoon: expiringSoon.count,
      expired: expired.count,
      wasteScore: calculateWasteScore(db),
      useTheseFirst: processedUseFirst
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRecipes = async (req: Request, res: Response) => {
  try {
    const items = db.prepare("SELECT name FROM items WHERE status = 'active' ORDER BY expiry_date ASC LIMIT 5").all() as any[];
    const itemNames = items.map(i => i.name);
    const recipes = await getRecipeSuggestions(itemNames);
    res.json(recipes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStats = (req: Request, res: Response) => {
  try {
    const allTime = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as saved,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM items
    `).get() as any;

    const sevenDaysAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last7Days = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as saved,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM items
      WHERE created_at >= ?
    `).get(sevenDaysAgo) as any;

    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM items 
      GROUP BY category
    `).all();

    const wasteScore = calculateWasteScore(db);
    let message = "You're doing great! Keep saving food.";
    if (wasteScore < 50) message = "You can do better! Try to use items before they expire.";
    else if (wasteScore > 80) message = "Excellent! You're a food-saving pro.";

    res.json({
      allTime: { saved: allTime.saved || 0, expired: allTime.expired || 0 },
      last7Days: { saved: last7Days.saved || 0, expired: last7Days.expired || 0 },
      byCategory,
      wasteScore,
      motivationalMessage: message
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addCustomRecipe = (req: Request, res: Response) => {
  const { title, cookTime, ingredients, steps } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  try {
    const stmt = db.prepare('INSERT INTO custom_recipes (title, cook_time, ingredients, steps) VALUES (?, ?, ?, ?)');
    const info = stmt.run(title, cookTime, JSON.stringify(ingredients || []), JSON.stringify(steps || []));
    res.status(201).json({ id: info.lastInsertRowid, message: "Recipe added successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listCustomRecipes = (req: Request, res: Response) => {
  try {
    const recipes = db.prepare('SELECT * FROM custom_recipes ORDER BY created_at DESC').all() as any[];
    const processed = recipes.map(r => ({
      ...r,
      cookTime: r.cook_time,
      ingredients: JSON.parse(r.ingredients || '[]'),
      steps: JSON.parse(r.steps || '[]'),
      isCustom: true
    }));
    res.json(processed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomRecipe = (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM custom_recipes WHERE id = ?').run(id);
    res.json({ message: "Recipe deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const suggestShoppingItems = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    const aiRes = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `You are a shopping assistant. Based on this request: "${prompt}", return a JSON array of items to add to a shopping list. 
      Each item must have: "name" and "category" (must be one of: dairy, vegetables, meat, grains, other).
      Return ONLY valid JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['dairy', 'vegetables', 'meat', 'grains', 'other'] }
            },
            required: ["name", "category"]
          }
        }
      }
    });

    const result = JSON.parse(aiRes.text || "[]");
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

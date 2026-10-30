# FreshKeep Backend

FreshKeep is a food-waste reduction application built with Node.js, Express, and SQLite. It features AI-powered recipe suggestions using the Google Gemini API.

## Features
- **Inventory Tracking**: Manage items with categories, quantities, and expiry dates.
- **AI Recipes**: Get 3 recipe suggestions based on your soon-to-expire items.
- **Dashboard & Alerts**: Stay on top of expiring food with a real-time dashboard.
- **Waste Score**: Track your efficiency in saving food.
- **Auto-Expiry**: A background job automatically marks overdue items as expired daily.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file (or set secrets in AI Studio) with:
   ```
   GEMINI_API_KEY="your_api_key_here"
   ```

3. **Run Locally**:
   ```bash
   npm run dev
   ```
   The server will start at `http://localhost:3000`. The database (`freshkeep.db`) will be created and seeded automatically on the first run.

## API Documentation & Example Requests

### 1. Add an Item
`POST /api/items`
```bash
curl -X POST http://localhost:3000/api/items \
-H "Content-Type: application/json" \
-d '{"name": "Milk", "category": "dairy", "quantity": 1, "expiry_date": "2026-11-05"}'
```

### 2. List Items
`GET /api/items`
Query params: `search`, `category`, `status`.
```bash
curl "http://localhost:3000/api/items?category=dairy&status=active"
```

### 3. Mark as Used (Saved)
`PATCH /api/items/:id/used`
```bash
curl -X PATCH http://localhost:3000/api/items/1/used
```

### 4. Get AI Recipes
`GET /api/recipes`
```bash
curl http://localhost:3000/api/recipes
```

### 5. Dashboard Summary
`GET /api/dashboard`
```bash
curl http://localhost:3000/api/dashboard
```

## Edge Cases to Test
1. **Adding an item with a past expiry date**: The system should allow it, but the item should immediately show as "expiring" or "expired" in the UI.
2. **Empty Inventory Recipes**: Check if the recipe endpoint returns the fallback list when no items are in the pantry.
3. **AI Failure**: Simulate a Gemini API error (e.g., by using an invalid key) to ensure the fallback recipes are served gracefully.

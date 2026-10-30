import { GoogleGenAI, Type } from "@google/genai";

export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export { Type } from "@google/genai";

export interface Recipe {
  title: string;
  cookTime: string;
  ingredients: string[];
  usesExpiring: string[];
  steps: string[];
}

const FALLBACK_RECIPES: Recipe[] = [
  {
    title: "Vegetable Stir-Fry",
    cookTime: "15 mins",
    ingredients: ["Mixed vegetables", "Soy sauce", "Garlic", "Ginger", "Rice"],
    usesExpiring: ["Vegetables"],
    steps: ["Chop vegetables", "Sauté with garlic and ginger", "Add soy sauce", "Serve over rice"]
  },
  {
    title: "Omelette Surprise",
    cookTime: "10 mins",
    ingredients: ["Eggs", "Milk", "Cheese", "Leftover veggies", "Butter"],
    usesExpiring: ["Eggs", "Milk", "Veggies"],
    steps: ["Whisk eggs and milk", "Pour into hot buttered pan", "Add fillings", "Fold and serve"]
  },
  {
    title: "Simple Pasta",
    cookTime: "20 mins",
    ingredients: ["Pasta", "Olive oil", "Garlic", "Parmesan", "Herbs"],
    usesExpiring: ["Herbs"],
    steps: ["Boil pasta", "Sauté garlic in oil", "Toss pasta with oil and garlic", "Top with cheese"]
  }
];

export async function getRecipeSuggestions(items: string[]): Promise<Recipe[]> {
  if (!items.length) return FALLBACK_RECIPES;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash", // Using a fast model for recipes
      contents: `Suggest 3 simple recipes using these soonest-expiring items: ${items.join(', ')}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              cookTime: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              usesExpiring: { type: Type.ARRAY, items: { type: Type.STRING } },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["title", "cookTime", "ingredients", "usesExpiring", "steps"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result.length > 0 ? result : FALLBACK_RECIPES;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return FALLBACK_RECIPES;
  }
}

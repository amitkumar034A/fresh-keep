import { Router } from 'express';
import * as itemsController from '../controllers/items.ts';
import * as apiController from '../controllers/apiController.ts';

const router = Router();

router.post('/items', itemsController.addItem);
router.get('/items', itemsController.listItems);
router.put('/items/:id', itemsController.editItem);
router.delete('/items/:id', itemsController.deleteItem);
router.patch('/items/:id/used', itemsController.useItem);
router.post('/items/:id/restock', itemsController.restockItem);
router.post('/items/bulk-delete', itemsController.bulkDelete);
router.post('/items/bulk-used', itemsController.bulkUsed);

router.get('/alerts', itemsController.getAlerts);
router.get('/dashboard', apiController.getDashboard);
router.get('/recipes', apiController.getRecipes);
router.get('/stats', apiController.getStats);

router.post('/recipes/custom', apiController.addCustomRecipe);
router.get('/recipes/custom', apiController.listCustomRecipes);
router.delete('/recipes/custom/:id', apiController.deleteCustomRecipe);

router.post('/shopping/suggest', apiController.suggestShoppingItems);

export default router;

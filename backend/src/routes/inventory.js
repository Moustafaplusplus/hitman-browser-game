import express from 'express';
import { InventoryController } from '../controllers/InventoryController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all inventory routes
router.use(auth);

// GET /api/inventory - Get user's inventory
router.get('/', InventoryController.getInventory);

// POST /api/inventory/equip - Equip an item
router.post('/equip', InventoryController.equipItem);

// POST /api/inventory/unequip - Unequip an item
router.post('/unequip', InventoryController.unequipItem);

// POST /api/inventory/sell - Sell an item
router.post('/sell', InventoryController.sellItem);

export default router; 
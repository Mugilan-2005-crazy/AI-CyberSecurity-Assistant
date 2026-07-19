/**
 * routes/adminRoutes.js
 * Admin-only endpoints. Gated by protect + authorize('admin').
 * Mounted at /api/admin
 */
import express from 'express';
import { listUsers, updateUser, deleteUser, analytics, logs, notifications } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, authorize('admin'));

router.get('/users', listUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/analytics', analytics);
router.get('/logs', logs);
router.get('/notifications', notifications);

export default router;

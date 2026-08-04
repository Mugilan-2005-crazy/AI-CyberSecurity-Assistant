/**
 * routes/adminRoutes.js
 * Admin-only endpoints. Gated by protect + authorize('admin').
 * Mounted at /api/admin
 * @openapi
 * components:
 *   schemas:
 *     UserUpdateRequest:
 *       type: object
 *       properties:
 *         role:
 *           type: string
 *           enum: [user, admin]
 *         isActive:
 *           type: boolean
 */
import express from 'express';
import { listUsers, updateUser, deleteUser, analytics, logs, notifications } from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, authorize('admin'));

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List all users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', listUsers);
/**
 * @openapi
 * /api/admin/users/{id}:
 *   patch:
 *     tags:
 *       - Admin
 *     summary: Update user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: User updated
 */
router.patch('/users/:id', updateUser);
/**
 * @openapi
 * /api/admin/users/{id}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: Delete user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/users/:id', deleteUser);
/**
 * @openapi
 * /api/admin/analytics:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Platform analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 */
router.get('/analytics', analytics);
/**
 * @openapi
 * /api/admin/logs:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Scan logs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scan logs
 */
router.get('/logs', logs);
/**
 * @openapi
 * /api/admin/notifications:
 *   get:
 *     tags:
 *       - Admin
 *     summary: User notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/notifications', notifications);

export default router;

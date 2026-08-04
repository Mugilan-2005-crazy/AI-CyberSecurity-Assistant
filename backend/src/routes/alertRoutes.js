import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getAlerts, getAlertById, acknowledgeAlert, getAlertsByUser, getDashboardAlerts } from '../controllers/alertController.js';
import { ownResource } from '../middleware/tenantIsolation.js';

const router = Router();

router.use(protect);

router.get('/', getAlerts);
router.get('/dashboard', getDashboardAlerts);
router.get('/user', getAlertsByUser);

router.get('/admin/all', authorize('admin'), getAlerts);

router.get('/:id', getAlertById);
router.patch('/:id/acknowledge', acknowledgeAlert);

export default router;
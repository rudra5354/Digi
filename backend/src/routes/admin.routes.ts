import { Router } from 'express';
import { adminActivityHandler, adminOverviewHandler, adminPackagesHandler, adminUsersHandler, adminVerificationsHandler } from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/overview', adminOverviewHandler);
router.get('/users', adminUsersHandler);
router.get('/packages', adminPackagesHandler);
router.get('/verifications', adminVerificationsHandler);
router.get('/activity', adminActivityHandler);

export default router;

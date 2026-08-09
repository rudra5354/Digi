import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createPackageHandler } from '../controllers/package.controller';

const router = Router();

// POST /api/packages - Create a new package (Protected for authenticated senders)
router.post('/', requireAuth, createPackageHandler);

export default router;

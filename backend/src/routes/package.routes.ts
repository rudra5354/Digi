import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { createPackageHandler, uploadFilesHandler } from '../controllers/package.controller';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

// POST /api/packages - Create a new package (Protected for authenticated senders)
router.post('/', requireAuth, createPackageHandler);

// POST /api/packages/:id/files - Upload files to a package (Protected for authenticated senders)
router.post('/:id/files', requireAuth, uploadMiddleware.array('files', 10), uploadFilesHandler);

export default router;

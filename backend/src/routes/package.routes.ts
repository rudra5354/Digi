import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';
import { 
  createPackageHandler, 
  uploadFilesHandler,
  listSenderPackagesHandler,
  revokePackageHandler,
  deletePackageHandler,
  retrievePackageHandler,
  verifyPackagePinHandler,
  getPackageMetadataHandler,
  claimPackageHandler,
  downloadFileHandler
} from '../controllers/package.controller';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

const pinVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: { code: 'TOO_MANY_PIN_ATTEMPTS', message: 'Too many PIN attempts. Please try again later.' },
    meta: {},
  },
});

// ==========================================
// Protected Sender Routes
// ==========================================

// GET /api/packages - List all packages created by the authenticated sender
router.get('/', requireAuth, listSenderPackagesHandler);

// POST /api/packages - Create a new package
router.post('/', requireAuth, createPackageHandler);

// POST /api/packages/:id/files - Upload files to a package
router.post('/:id/files', requireAuth, uploadMiddleware.array('files', 10), uploadFilesHandler);

// POST /api/packages/:id/revoke - Revoke a package
router.post('/:id/revoke', requireAuth, revokePackageHandler);

// DELETE /api/packages/:id - Delete a package and its files
router.delete('/:id', requireAuth, deletePackageHandler);

// ==========================================
// Public Recipient Routes
// ==========================================

// GET /api/packages/retrieve/:accessCode - Phase 10 safe package retrieval
router.get('/retrieve/:accessCode', retrievePackageHandler);

// POST /api/packages/:packageId/verify-pin - Phase 11 verification only
router.post('/:packageId/verify-pin', pinVerificationLimiter, verifyPackagePinHandler);

// GET /api/packages/share/:accessCode - Check if access code is valid and active, return metadata
router.get('/share/:accessCode', getPackageMetadataHandler);

// POST /api/packages/share/:accessCode/claim - Verify PIN and claim files list
router.post('/share/:accessCode/claim', claimPackageHandler);

// GET /api/packages/share/:accessCode/files/:fileId/download - Redirect to secure download URL
router.get('/share/:accessCode/files/:fileId/download', downloadFileHandler);

export default router;

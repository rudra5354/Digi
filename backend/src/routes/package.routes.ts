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
  getPackagePreviewHandler,
  createPreviewDownloadHandler,
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

// Download requests can trigger signed URL generation. Limit attempts to reduce
// brute-force PIN guessing and signed-link abuse while allowing normal use.
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: { code: 'TOO_MANY_DOWNLOAD_ATTEMPTS', message: 'Too many download attempts. Please try again later.' },
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

// GET /api/packages/:packageId/preview - Phase 12 authorized file previews
router.get('/:packageId/preview', getPackagePreviewHandler);

// POST /api/packages/:packageId/files/:fileId/download - authorized individual download
router.post('/:packageId/files/:fileId/download', downloadLimiter, createPreviewDownloadHandler);

// GET /api/packages/share/:accessCode - Check if access code is valid and active, return metadata
router.get('/share/:accessCode', getPackageMetadataHandler);

// POST /api/packages/share/:accessCode/claim - Verify PIN and claim files list
router.post('/share/:accessCode/claim', claimPackageHandler);

// GET /api/packages/share/:accessCode/files/:fileId/download - Redirect to secure download URL
router.get('/share/:accessCode/files/:fileId/download', downloadLimiter, downloadFileHandler);

export default router;

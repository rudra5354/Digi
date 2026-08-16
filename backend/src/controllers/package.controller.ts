import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  createPackage, 
  addFilesToPackage,
  getPackageMetadataByAccessCode,
  createPreviewSession,
  getPackagePreviewFiles,
  getAuthorizedPreviewFile,
  recordPreviewDownload,
  verifyPackagePin,
  claimPackage,
  downloadPackageFile,
  getPackagesBySender,
  revokePackage,
  deletePackage
} from '../services/package.service';
import { generateSignedDownloadUrl } from '../services/storage';

const createPackageSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(255, 'Title cannot exceed 255 characters'),
  expiryHours: z
    .number()
    .int('Expiry hours must be an integer')
    .min(1, 'Expiry must be at least 1 hour')
    .max(168, 'Expiry cannot exceed 168 hours (7 days)')
    .default(24),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, 'PIN must be 4 to 8 digits')
    .optional()
    .or(z.literal('')),
});

const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4 to 8 numeric digits'),
});

/**
 * Controller to handle POST /api/packages requests
 */
export const createPackageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context is missing.',
        },
        meta: {},
      });
    }

    const validationResult = createPackageSchema.safeParse(req.body);

    if (!validationResult.success) {
      const issue = validationResult.error.issues[0];
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: `${issue.path.join('.')}: ${issue.message}`,
        },
        meta: {},
      });
    }

    const { title, expiryHours, pin } = validationResult.data;

    const createdPackage = await createPackage({
      senderId: req.user.id,
      title,
      expiryHours,
      pin: pin && pin.trim().length > 0 ? pin.trim() : undefined,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({
      success: true,
      data: createdPackage,
      error: null,
      meta: {},
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Controller to handle POST /api/packages/:id/files requests
 */
export const uploadFilesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context is missing.',
        },
        meta: {},
      });
    }

    const { id: packageId } = req.params;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Package ID parameter is required.',
        },
        meta: {},
      });
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'No files uploaded.',
        },
        meta: {},
      });
    }

    const uploadedFiles = await addFilesToPackage(packageId, req.user.id, files);

    return res.status(201).json({
      success: true,
      data: {
        packageId,
        files: uploadedFiles,
      },
      error: null,
      meta: {},
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Controller to handle GET /api/packages (Protected for authenticated senders)
 */
export const listSenderPackagesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context is missing.',
        },
        meta: {},
      });
    }

    const packages = await getPackagesBySender(req.user.id);

    return res.status(200).json({
      success: true,
      data: packages,
      error: null,
      meta: {},
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Controller to handle POST /api/packages/:id/revoke (Protected for authenticated senders)
 */
export const revokePackageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context is missing.',
        },
        meta: {},
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Package ID parameter is required.',
        },
        meta: {},
      });
    }

    await revokePackage(id, req.user.id);

    return res.status(200).json({
      success: true,
      data: { message: 'Package revoked successfully.' },
      error: null,
      meta: {},
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Controller to handle DELETE /api/packages/:id (Protected for authenticated senders)
 */
export const deletePackageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication context is missing.',
        },
        meta: {},
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Package ID parameter is required.',
        },
        meta: {},
      });
    }

    await deletePackage(id, req.user.id);

    return res.status(200).json({
      success: true,
      data: { message: 'Package deleted successfully.' },
      error: null,
      meta: {},
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * Controller to handle GET /api/packages/share/:accessCode (Public)
 */
export const getPackageMetadataHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessCode } = req.params;

    if (!accessCode) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access code parameter is required.',
        },
        meta: {},
      });
    }

    // Basic format check (XXXX-XXXX)
    const normalizedCode = accessCode.trim().replace(/\s+/g, '');
    if (!/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_FORMAT',
          message: 'Invalid access code format. Correct format is XXXX-XXXX.',
        },
        meta: {},
      });
    }

    const metadata = await getPackageMetadataByAccessCode(normalizedCode);

    return res.status(200).json({
      success: true,
      data: metadata,
      error: null,
      meta: {},
    });
  } catch (err: any) {
    if (err.message === 'Package not found.') {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Package not found.',
        },
        meta: {},
      });
    }
    if (err.message.includes('no longer active')) {
      return res.status(410).json({
        success: false,
        data: null,
        error: {
          code: 'INACTIVE_PACKAGE',
          message: err.message,
        },
        meta: {},
      });
    }
    next(err);
  }
};

/**
 * Public Phase 10 retrieval endpoint. It deliberately returns only the
 * metadata a recipient needs to proceed to later verification stages.
 */
export const retrievePackageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessCode } = req.params;
    const normalizedCode = accessCode?.trim().replace(/\s+/g, '');

    if (!normalizedCode || !/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_ACCESS_CODE',
          message: 'Enter a valid access code in the format XXXX-XXXX.',
        },
        meta: {},
      });
    }

    const metadata = await getPackageMetadataByAccessCode(normalizedCode, req.ip, req.headers['user-agent']);

    return res.status(200).json({
      success: true,
      data: {
        id: metadata.id,
        title: metadata.title,
        status: metadata.status,
        expiresAt: metadata.expiresAt,
        hasPin: metadata.hasPin,
        fileCount: metadata.filesCount,
        previewToken: metadata.hasPin ? undefined : createPreviewSession(metadata.id),
      },
      error: null,
      meta: {},
    });
  } catch (err: any) {
    if (err.message === 'Package not found.') {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Package not found.' }, meta: {} });
    }
    if (err.message.includes('Status: EXPIRED')) {
      return res.status(410).json({ success: false, data: null, error: { code: 'PACKAGE_EXPIRED', message: 'This package has expired.' }, meta: {} });
    }
    if (err.message.includes('Status: REVOKED')) {
      return res.status(403).json({ success: false, data: null, error: { code: 'PACKAGE_REVOKED', message: 'This package is no longer available.' }, meta: {} });
    }
    next(err);
  }
};

/**
 * Phase 12 preview endpoint. It returns file metadata and short-lived preview
 * URLs only; it does not download files or expose storage paths.
 */
export const getPackagePreviewHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.params;
    if (!packageId || !z.string().uuid().safeParse(packageId).success) {
      return res.status(400).json({ success: false, data: null, error: { code: 'INVALID_PACKAGE_ID', message: 'A valid package ID is required.' }, meta: {} });
    }

    const authorization = req.headers.authorization;
    const previewToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    const files = await getPackagePreviewFiles(packageId, previewToken, req.ip, req.headers['user-agent']);
    return res.status(200).json({ success: true, data: { files }, error: null, meta: {} });
  } catch (err: any) {
    if (err.message === 'Package not found.') {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Package not found.' }, meta: {} });
    }
    if (err.message === 'PREVIEW_NOT_AUTHORIZED') {
      return res.status(403).json({ success: false, data: null, error: { code: 'PREVIEW_NOT_AUTHORIZED', message: 'Verify package access before viewing previews.' }, meta: {} });
    }
    if (err.message.includes('Status: EXPIRED')) {
      return res.status(410).json({ success: false, data: null, error: { code: 'PACKAGE_EXPIRED', message: 'This package has expired.' }, meta: {} });
    }
    if (err.message.includes('Status: REVOKED')) {
      return res.status(403).json({ success: false, data: null, error: { code: 'PACKAGE_REVOKED', message: 'This package is no longer available.' }, meta: {} });
    }
    next(err);
  }
};

/**
 * Generates a short-lived URL for exactly one preview-authorized file.
 */
export const createPreviewDownloadHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId, fileId } = req.params;
    if (!z.string().uuid().safeParse(packageId).success || !z.string().uuid().safeParse(fileId).success) {
      return res.status(400).json({ success: false, data: null, error: { code: 'INVALID_INPUT', message: 'A valid package and file ID are required.' }, meta: {} });
    }

    const authorization = req.headers.authorization;
    const previewToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    const { filePath, fileName } = await getAuthorizedPreviewFile(packageId, fileId, previewToken);
    const { signedUrl, error } = await generateSignedDownloadUrl(filePath, 60, fileName);
    if (error || !signedUrl) throw error || new Error('Unable to prepare file download.');

    await recordPreviewDownload(packageId, req.ip, req.headers['user-agent']);

    return res.status(200).json({ success: true, data: { downloadUrl: signedUrl, expiresInSeconds: 60 }, error: null, meta: {} });
  } catch (err: any) {
    if (err.message === 'Package not found.' || err.message === 'File not found in this package.') {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Requested file is unavailable.' }, meta: {} });
    }
    if (err.message === 'PREVIEW_NOT_AUTHORIZED') {
      return res.status(403).json({ success: false, data: null, error: { code: 'PREVIEW_NOT_AUTHORIZED', message: 'Verify package access before downloading files.' }, meta: {} });
    }
    if (err.message.includes('Status: EXPIRED')) {
      return res.status(410).json({ success: false, data: null, error: { code: 'PACKAGE_EXPIRED', message: 'This package has expired.' }, meta: {} });
    }
    if (err.message.includes('Status: REVOKED')) {
      return res.status(403).json({ success: false, data: null, error: { code: 'PACKAGE_REVOKED', message: 'This package is no longer available.' }, meta: {} });
    }
    next(err);
  }
};

/**
 * Controller for Phase 11 PIN verification. It never claims a package or
 * returns its files; it only establishes that the submitted PIN is valid.
 */
export const verifyPackagePinHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packageId } = req.params;
    const validationResult = verifyPinSchema.safeParse(req.body);

    if (!packageId || !z.string().uuid().safeParse(packageId).success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'INVALID_PACKAGE_ID', message: 'A valid package ID is required.' },
        meta: {},
      });
    }

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'INVALID_PIN_FORMAT', message: 'PIN must be 4 to 8 numeric digits.' },
        meta: {},
      });
    }

    const result = await verifyPackagePin(
      packageId,
      validationResult.data.pin,
      req.ip,
      req.headers['user-agent']
    );

    return res.status(200).json({ success: true, data: result, error: null, meta: {} });
  } catch (err: any) {
    if (err.message === 'Package not found.') {
      return res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Package not found.' }, meta: {} });
    }
    if (err.message === 'INVALID_PIN') {
      return res.status(401).json({ success: false, data: null, error: { code: 'INVALID_PIN', message: 'The PIN is incorrect.' }, meta: {} });
    }
    if (err.message.includes('Status: EXPIRED')) {
      return res.status(410).json({ success: false, data: null, error: { code: 'PACKAGE_EXPIRED', message: 'This package has expired.' }, meta: {} });
    }
    if (err.message.includes('Status: REVOKED')) {
      return res.status(403).json({ success: false, data: null, error: { code: 'PACKAGE_REVOKED', message: 'This package is no longer available.' }, meta: {} });
    }
    next(err);
  }
};

/**
 * Controller to handle POST /api/packages/share/:accessCode/claim (Public)
 */
export const claimPackageHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessCode } = req.params;
    const { pin } = req.body;

    if (!accessCode) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access code parameter is required.',
        },
        meta: {},
      });
    }

    const normalizedCode = accessCode.trim().replace(/\s+/g, '');
    const result = await claimPackage(normalizedCode, pin, req.ip, req.headers['user-agent']);

    return res.status(200).json({
      success: true,
      data: result,
      error: null,
      meta: {},
    });
  } catch (err: any) {
    if (err.message === 'Package not found.') {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Package not found.',
        },
        meta: {},
      });
    }
    if (err.message === 'INVALID_PIN') {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_PIN',
          message: 'The PIN you entered is incorrect.',
        },
        meta: {},
      });
    }
    if (err.message.includes('no longer active')) {
      return res.status(410).json({
        success: false,
        data: null,
        error: {
          code: 'INACTIVE_PACKAGE',
          message: err.message,
        },
        meta: {},
      });
    }
    next(err);
  }
};

/**
 * Controller to handle GET /api/packages/share/:accessCode/files/:fileId/download (Public)
 * Redirects client browser to a temporary signed download URL on success.
 */
export const downloadFileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessCode, fileId } = req.params;
    const { pin } = req.query;

    if (!accessCode || !fileId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_INPUT',
          message: 'Access code and File ID parameters are required.',
        },
        meta: {},
      });
    }

    const normalizedCode = accessCode.trim().replace(/\s+/g, '');
    const pinString = pin ? String(pin) : undefined;

    const { filePath, fileName } = await downloadPackageFile(
      normalizedCode,
      fileId,
      pinString,
      req.ip,
      req.headers['user-agent']
    );

    // Generate signed download URL valid for 60 seconds
    const { signedUrl, error: signError } = await generateSignedDownloadUrl(filePath, 60, fileName);

    if (signError || !signedUrl) {
      throw signError || new Error('Failed to generate download path.');
    }

    // Redirect recipient to Supabase Storage signed download URL
    return res.redirect(signedUrl);
  } catch (err: any) {
    if (err.message === 'Package not found.' || err.message === 'File not found in this package.') {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: err.message,
        },
        meta: {},
      });
    }
    if (err.message === 'INVALID_PIN') {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_PIN',
          message: 'Access denied. The PIN provided is incorrect.',
        },
        meta: {},
      });
    }
    if (err.message.includes('no longer active')) {
      return res.status(410).json({
        success: false,
        data: null,
        error: {
          code: 'INACTIVE_PACKAGE',
          message: err.message,
        },
        meta: {},
      });
    }
    next(err);
  }
};

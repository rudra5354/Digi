import { supabase } from './supabase';
import { generateAccessCode, hashPin, verifyPin } from '../utils/crypto';
import { uploadFileToStorage, deleteFileFromStorage, deletePackageFilesFromStorage, generateSignedDownloadUrl } from './storage';
import { config } from '../config';
import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';

export interface CreatePackageDTO {
  senderId: string;
  title: string;
  expiryHours: number;
  pin?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface PackageResponse {
  id: string;
  senderId: string;
  title: string;
  accessCode: string;
  status: string;
  expiresAt: string;
  hasPin: boolean;
  downloadCount: number;
  createdAt: string;
}

const PREVIEW_TOKEN_TTL_SECONDS = 5 * 60;

const createPreviewSessionToken = (packageId: string): string => jwt.sign(
  { packageId, purpose: 'PACKAGE_PREVIEW' },
  config.JWT_SECRET,
  { expiresIn: PREVIEW_TOKEN_TTL_SECONDS }
);

const hasValidPreviewSession = (token: string | undefined, packageId: string): boolean => {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    return payload.packageId === packageId && payload.purpose === 'PACKAGE_PREVIEW';
  } catch {
    return false;
  }
};

export interface PreviewFileResponse {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewKind: 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | 'unavailable';
  previewAvailable: boolean;
  previewUrl?: string;
  previewMessage?: string;
}

type PreviewKind = PreviewFileResponse['previewKind'];
const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024;

const getPreviewKind = (mimeType: string, fileName: string): PreviewKind => {
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  const extension = fileName.toLowerCase().split('.').pop() || '';

  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'].includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (['video/mp4', 'video/webm', 'video/ogg'].includes(mime)) return 'video';
  if (['audio/mpeg', 'audio/wav', 'audio/ogg'].includes(mime)) return 'audio';
  if (['text/plain', 'text/csv', 'application/json'].includes(mime)) return 'text';
  if (['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(mime)) return 'office';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (['mp4', 'webm', 'ogv'].includes(extension)) return 'video';
  if (['mp3', 'wav'].includes(extension)) return 'audio';
  if (['txt', 'csv', 'json'].includes(extension)) return 'text';
  if (['docx', 'xlsx', 'pptx'].includes(extension)) return 'office';
  return 'unavailable';
};

export const createPreviewSession = (packageId: string): string => createPreviewSessionToken(packageId);

/**
 * Creates a new temporary delivery package in the database.
 */
export const createPackage = async (dto: CreatePackageDTO): Promise<PackageResponse> => {
  const { senderId, title, expiryHours, pin, clientIp, userAgent } = dto;

  // 1. Generate a collision-free Access Code
  let accessCode = '';
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 5) {
    attempts++;
    const candidateCode = generateAccessCode();
    const { data } = await supabase
      .from('packages')
      .select('id')
      .eq('access_code', candidateCode)
      .limit(1);

    if (!data || data.length === 0) {
      accessCode = candidateCode;
      isUnique = true;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate a unique Access Code. Please try again.');
  }

  // 2. Hash PIN if provided
  const pinHash = pin && pin.trim().length > 0 ? hashPin(pin.trim()) : null;

  // 3. Calculate expiration timestamp
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // 4. Insert Package record into Supabase
  const { data: newPackage, error: insertError } = await supabase
    .from('packages')
    .insert({
      sender_id: senderId,
      title: title.trim(),
      access_code: accessCode,
      pin_hash: pinHash,
      status: 'ACTIVE',
      expires_at: expiresAt,
      download_count: 0,
    })
    .select()
    .single();

  if (insertError || !newPackage) {
    console.error('Error inserting package into database:', insertError?.message);
    throw new Error(insertError?.message || 'Failed to create package record in database.');
  }

  // 5. Log Security Audit Event
  try {
    await supabase.from('security_audit_events').insert({
      actor_id: senderId,
      event_type: 'PACKAGE_CREATED',
      description: `Created package '${title}' (Code: ${accessCode}) expiring in ${expiryHours}h.`,
      ip_address: clientIp || null,
      user_agent: userAgent || null,
    });
  } catch (auditErr: any) {
    console.warn('Non-blocking security audit log failed:', auditErr.message);
  }

  return {
    id: newPackage.id,
    senderId: newPackage.sender_id,
    title: newPackage.title,
    accessCode: newPackage.access_code,
    status: newPackage.status,
    expiresAt: newPackage.expires_at,
    hasPin: !!newPackage.pin_hash,
    downloadCount: newPackage.download_count,
    createdAt: newPackage.created_at,
  };
};

export interface PackageFileResponse {
  id: string;
  packageId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

/**
 * Uploads and attaches multiple files to an existing active package.
 */
export const addFilesToPackage = async (
  packageId: string,
  senderId: string,
  files: Express.Multer.File[]
): Promise<PackageFileResponse[]> => {
  if (!files || files.length === 0) {
    throw new Error('No files provided for upload.');
  }

  // 1. Verify package ownership and active status
  const { data: pkg, error: pkgError } = await supabase
    .from('packages')
    .select('id, sender_id, status, expires_at')
    .eq('id', packageId)
    .single();

  if (pkgError || !pkg) {
    throw new Error('Package not found.');
  }

  if (pkg.sender_id !== senderId) {
    throw new Error('Unauthorized. You do not own this package.');
  }

  if (pkg.status !== 'ACTIVE' || new Date(pkg.expires_at) < new Date()) {
    throw new Error('Cannot add files to an expired or revoked package.');
  }

  const fileRecords: PackageFileResponse[] = [];

  // 2. Upload each file to Supabase Storage and insert metadata into DB
  for (const file of files) {
    const fileId = crypto.randomUUID();
    
    // Upload buffer to private bucket
    const { filePath, error: uploadErr } = await uploadFileToStorage(
      packageId,
      fileId,
      file.buffer,
      file.mimetype,
      file.originalname
    );

    if (uploadErr || !filePath) {
      throw new Error(`Failed to upload file '${file.originalname}' to storage: ${uploadErr?.message}`);
    }

    // Insert into package_files table
    const { data: dbFile, error: dbErr } = await supabase
      .from('package_files')
      .insert({
        id: fileId,
        package_id: packageId,
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.mimetype,
      })
      .select()
      .single();

    if (dbErr || !dbFile) {
      // Rollback: delete storage object if DB record creation failed
      await deleteFileFromStorage(filePath);
      console.error('Failed to insert package_files record:', dbErr?.message);
      throw new Error(`Failed to record file '${file.originalname}' in database.`);
    }

    fileRecords.push({
      id: dbFile.id,
      packageId: dbFile.package_id,
      fileName: dbFile.file_name,
      filePath: dbFile.file_path,
      fileSize: Number(dbFile.file_size),
      mimeType: dbFile.mime_type,
      createdAt: dbFile.created_at,
    });
  }

  return fileRecords;
};

export interface SenderPackageResponse {
  id: string;
  title: string;
  accessCode: string;
  status: string;
  expiresAt: string;
  revokedAt: string | null;
  downloadCount: number;
  createdAt: string;
  hasPin: boolean;
  filesCount: number;
}

/**
 * Retrieves basic metadata of an active package by its access code.
 * Used for recipient initial screen.
 */
export const getPackageMetadataByAccessCode = async (
  accessCode: string,
  clientIp?: string,
  userAgent?: string
): Promise<Omit<PackageResponse, 'senderId'> & { filesCount: number }> => {
  const formattedCode = accessCode.trim().toUpperCase();

  // Fetch package details
  const { data: pkg, error } = await supabase
    .from('packages')
    .select('id, title, access_code, status, expires_at, pin_hash, download_count, created_at')
    .eq('access_code', formattedCode)
    .single();

  if (error || !pkg) {
    throw new Error('Package not found.');
  }

  // Check if expired and active. If so, update DB status.
  const isExpired = new Date(pkg.expires_at) < new Date();
  if (isExpired && pkg.status === 'ACTIVE') {
    await supabase
      .from('packages')
      .update({ status: 'EXPIRED' })
      .eq('id', pkg.id);
    pkg.status = 'EXPIRED';
  }

  if (pkg.status !== 'ACTIVE') {
    throw new Error(`Package is no longer active (Status: ${pkg.status}).`);
  }

  // Get count of files
  const { count, error: countErr } = await supabase
    .from('package_files')
    .select('id', { count: 'exact', head: true })
    .eq('package_id', pkg.id);

  if (countErr) {
    console.error('Error counting files for package:', countErr.message);
  }

  const metadata = {
    id: pkg.id,
    title: pkg.title,
    accessCode: pkg.access_code,
    status: pkg.status,
    expiresAt: pkg.expires_at,
    hasPin: !!pkg.pin_hash,
    downloadCount: pkg.download_count,
    createdAt: pkg.created_at,
    filesCount: count || 0,
  };

  // Retrieval logging is useful to the sender but must not affect a recipient
  // receiving safe metadata if logging is temporarily unavailable.
  try {
    await supabase.from('package_access_logs').insert({
      package_id: pkg.id,
      access_type: 'VERIFY',
      status: 'SUCCESS',
      ip_address: clientIp || null,
      user_agent: userAgent || null,
    });
  } catch (logError: any) {
    console.warn('Non-blocking package retrieval log failed:', logError.message);
  }

  return metadata;
};

/**
 * Validates PIN (if applicable) and claims the package, returning file metadata.
 */
export const claimPackage = async (
  accessCode: string,
  pin?: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ package: Omit<PackageResponse, 'senderId'>; files: Omit<PackageFileResponse, 'filePath'>[] }> => {
  const formattedCode = accessCode.trim().toUpperCase();

  const { data: pkg, error } = await supabase
    .from('packages')
    .select('*')
    .eq('access_code', formattedCode)
    .single();

  if (error || !pkg) {
    throw new Error('Package not found.');
  }

  const isExpired = new Date(pkg.expires_at) < new Date();
  if (isExpired && pkg.status === 'ACTIVE') {
    await supabase
      .from('packages')
      .update({ status: 'EXPIRED' })
      .eq('id', pkg.id);
    pkg.status = 'EXPIRED';
  }

  if (pkg.status !== 'ACTIVE') {
    throw new Error(`Package is no longer active (Status: ${pkg.status}).`);
  }

  // Verify PIN if required
  if (pkg.pin_hash) {
    if (!pin || !verifyPin(pin, pkg.pin_hash)) {
      // Log authentication failure
      await supabase.from('package_access_logs').insert({
        package_id: pkg.id,
        access_type: 'AUTH_FAIL',
        status: 'FAILED',
        ip_address: clientIp || null,
        user_agent: userAgent || null,
        error_reason: 'Invalid or missing PIN',
      });
      throw new Error('INVALID_PIN');
    }
  }

  // Insert success verification log
  await supabase.from('package_access_logs').insert({
    package_id: pkg.id,
    access_type: 'VERIFY',
    status: 'SUCCESS',
    ip_address: clientIp || null,
    user_agent: userAgent || null,
  });

  // Fetch package files (omit internal filePath for security)
  const { data: files, error: filesErr } = await supabase
    .from('package_files')
    .select('id, package_id, file_name, file_size, mime_type, created_at')
    .eq('package_id', pkg.id);

  if (filesErr) {
    throw new Error('Failed to retrieve package files.');
  }

  return {
    package: {
      id: pkg.id,
      title: pkg.title,
      accessCode: pkg.access_code,
      status: pkg.status,
      expiresAt: pkg.expires_at,
      hasPin: !!pkg.pin_hash,
      downloadCount: pkg.download_count,
      createdAt: pkg.created_at,
    },
    files: (files || []).map((f) => ({
      id: f.id,
      packageId: f.package_id,
      fileName: f.file_name,
      fileSize: Number(f.file_size),
      mimeType: f.mime_type,
      createdAt: f.created_at,
    })),
  };
};

/**
 * Verifies a recipient PIN without exposing package files or storage details.
 * This is intentionally separate from the later claim/download operations.
 */
export const verifyPackagePin = async (
  packageId: string,
  pin: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ verified: true; pinRequired: boolean; previewToken: string }> => {
  const { data: pkg, error } = await supabase
    .from('packages')
    .select('id, pin_hash, status, expires_at')
    .eq('id', packageId)
    .single();

  if (error || !pkg) {
    throw new Error('Package not found.');
  }

  const isExpired = new Date(pkg.expires_at) < new Date();
  if (isExpired && pkg.status === 'ACTIVE') {
    await supabase.from('packages').update({ status: 'EXPIRED' }).eq('id', pkg.id);
    pkg.status = 'EXPIRED';
  }

  if (pkg.status !== 'ACTIVE') {
    throw new Error(`Package is no longer active (Status: ${pkg.status}).`);
  }

  // A PIN-less package should not be challenged. The frontend skips this route,
  // but this response keeps the endpoint safe if it is called directly.
  if (!pkg.pin_hash) {
    return { verified: true, pinRequired: false, previewToken: createPreviewSessionToken(pkg.id) };
  }

  if (!verifyPin(pin, pkg.pin_hash)) {
    try {
      await supabase.from('package_access_logs').insert({
        package_id: pkg.id,
        access_type: 'AUTH_FAIL',
        status: 'FAILED',
        ip_address: clientIp || null,
        user_agent: userAgent || null,
        error_reason: 'Invalid PIN',
      });
    } catch (logError: any) {
      console.warn('Non-blocking PIN failure log failed:', logError.message);
    }
    throw new Error('INVALID_PIN');
  }

  try {
    await supabase.from('package_access_logs').insert({
      package_id: pkg.id,
      access_type: 'VERIFY',
      status: 'SUCCESS',
      ip_address: clientIp || null,
      user_agent: userAgent || null,
    });
  } catch (logError: any) {
    console.warn('Non-blocking PIN verification log failed:', logError.message);
  }

  return { verified: true, pinRequired: true, previewToken: createPreviewSessionToken(pkg.id) };
};

/**
 * Returns safe file metadata and 60-second URLs only for PDF/image previews.
 * A signed preview session and an active package are required on every call.
 */
export const getPackagePreviewFiles = async (
  packageId: string,
  previewToken: string | undefined,
  clientIp?: string,
  userAgent?: string
): Promise<PreviewFileResponse[]> => {
  const { data: pkg, error: packageError } = await supabase
    .from('packages')
    .select('id, status, expires_at')
    .eq('id', packageId)
    .single();

  if (packageError || !pkg) throw new Error('Package not found.');
  if (new Date(pkg.expires_at) < new Date() && pkg.status === 'ACTIVE') {
    await supabase.from('packages').update({ status: 'EXPIRED' }).eq('id', pkg.id);
    pkg.status = 'EXPIRED';
  }
  if (pkg.status !== 'ACTIVE') throw new Error(`Package is no longer active (Status: ${pkg.status}).`);
  if (!hasValidPreviewSession(previewToken, pkg.id)) throw new Error('PREVIEW_NOT_AUTHORIZED');

  const { data: files, error: filesError } = await supabase
    .from('package_files')
    .select('id, file_name, file_size, mime_type, file_path')
    .eq('package_id', pkg.id)
    .order('created_at', { ascending: true });

  if (filesError) throw new Error('Failed to retrieve package files.');

  const previewFiles = await Promise.all((files || []).map(async (file): Promise<PreviewFileResponse> => {
    const previewKind = getPreviewKind(file.mime_type, file.file_name);
    const safeFile: PreviewFileResponse = {
      id: file.id,
      fileName: file.file_name,
      fileSize: Number(file.file_size),
      mimeType: file.mime_type,
      previewKind,
      previewAvailable: false,
    };

    if (previewKind === 'office') {
      return { ...safeFile, previewMessage: 'Preview unavailable: secure office conversion is not configured.' };
    }
    if (previewKind === 'unavailable') return safeFile;
    if (previewKind === 'text' && Number(file.file_size) > TEXT_PREVIEW_MAX_BYTES) {
      return { ...safeFile, previewMessage: 'Preview unavailable: text files over 1 MB are not displayed.' };
    }

    const { signedUrl } = await generateSignedDownloadUrl(file.file_path, 60);
    return signedUrl ? { ...safeFile, previewAvailable: true, previewUrl: signedUrl } : safeFile;
  }));

  try {
    await supabase.from('package_access_logs').insert({
      package_id: pkg.id,
      access_type: 'VERIFY',
      status: 'SUCCESS',
      ip_address: clientIp || null,
      user_agent: userAgent || null,
    });
  } catch (logError: any) {
    console.warn('Non-blocking package preview log failed:', logError.message);
  }

  return previewFiles;
};

/**
 * Authorizes one file for download using the same short-lived preview session.
 * The storage path remains internal and is never included in an API response.
 */
export const getAuthorizedPreviewFile = async (
  packageId: string,
  fileId: string,
  previewToken: string | undefined
): Promise<{ filePath: string; fileName: string }> => {
  const { data: pkg, error: packageError } = await supabase
    .from('packages')
    .select('id, status, expires_at')
    .eq('id', packageId)
    .single();

  if (packageError || !pkg) throw new Error('Package not found.');
  if (new Date(pkg.expires_at) < new Date() && pkg.status === 'ACTIVE') {
    await supabase.from('packages').update({ status: 'EXPIRED' }).eq('id', pkg.id);
    pkg.status = 'EXPIRED';
  }
  if (pkg.status !== 'ACTIVE') throw new Error(`Package is no longer active (Status: ${pkg.status}).`);
  if (!hasValidPreviewSession(previewToken, pkg.id)) throw new Error('PREVIEW_NOT_AUTHORIZED');

  const { data: file, error: fileError } = await supabase
    .from('package_files')
    .select('file_path, file_name')
    .eq('id', fileId)
    .eq('package_id', pkg.id)
    .single();

  if (fileError || !file) throw new Error('File not found in this package.');
  return { filePath: file.file_path, fileName: file.file_name };
};

/** Records an authorized per-file download without recording any file path. */
export const recordPreviewDownload = async (
  packageId: string,
  clientIp?: string,
  userAgent?: string
): Promise<void> => {
  try {
    const { data: pkg } = await supabase.from('packages').select('download_count').eq('id', packageId).single();
    if (pkg) await supabase.from('packages').update({ download_count: pkg.download_count + 1 }).eq('id', packageId);
    await supabase.from('package_access_logs').insert({
      package_id: packageId,
      access_type: 'DOWNLOAD',
      status: 'SUCCESS',
      ip_address: clientIp || null,
      user_agent: userAgent || null,
    });
  } catch (logError: any) {
    console.warn('Non-blocking preview download log failed:', logError.message);
  }
};

/**
 * Initiates download of a specific file: verifies pin, increments download counter, 
 * logs the access event, and returns file path.
 */
export const downloadPackageFile = async (
  accessCode: string,
  fileId: string,
  pin?: string,
  clientIp?: string,
  userAgent?: string
): Promise<{ filePath: string; fileName: string; mimeType: string }> => {
  const formattedCode = accessCode.trim().toUpperCase();

  // Fetch package details
  const { data: pkg, error } = await supabase
    .from('packages')
    .select('*')
    .eq('access_code', formattedCode)
    .single();

  if (error || !pkg) {
    throw new Error('Package not found.');
  }

  const isExpired = new Date(pkg.expires_at) < new Date();
  if (isExpired && pkg.status === 'ACTIVE') {
    await supabase
      .from('packages')
      .update({ status: 'EXPIRED' })
      .eq('id', pkg.id);
    pkg.status = 'EXPIRED';
  }

  if (pkg.status !== 'ACTIVE') {
    throw new Error(`Package is no longer active (Status: ${pkg.status}).`);
  }

  // Verify PIN if required
  if (pkg.pin_hash) {
    if (!pin || !verifyPin(pin, pkg.pin_hash)) {
      await supabase.from('package_access_logs').insert({
        package_id: pkg.id,
        access_type: 'AUTH_FAIL',
        status: 'FAILED',
        ip_address: clientIp || null,
        user_agent: userAgent || null,
        error_reason: 'Invalid or missing PIN for download',
      });
      throw new Error('INVALID_PIN');
    }
  }

  // Fetch file details
  const { data: file, error: fileErr } = await supabase
    .from('package_files')
    .select('*')
    .eq('id', fileId)
    .eq('package_id', pkg.id)
    .single();

  if (fileErr || !file) {
    throw new Error('File not found in this package.');
  }

  // Increment download counter
  const { error: updateErr } = await supabase
    .from('packages')
    .update({ download_count: pkg.download_count + 1 })
    .eq('id', pkg.id);

  if (updateErr) {
    console.error('Failed to increment download count:', updateErr.message);
  }

  // Log successful download access log
  await supabase.from('package_access_logs').insert({
    package_id: pkg.id,
    access_type: 'DOWNLOAD',
    status: 'SUCCESS',
    ip_address: clientIp || null,
    user_agent: userAgent || null,
  });

  return {
    filePath: file.file_path,
    fileName: file.file_name,
    mimeType: file.mime_type,
  };
};

/**
 * Returns all packages created by a specific sender.
 */
export const getPackagesBySender = async (
  senderId: string
): Promise<SenderPackageResponse[]> => {
  const { data: packages, error } = await supabase
    .from('packages')
    .select(`
      id,
      title,
      access_code,
      status,
      expires_at,
      revoked_at,
      download_count,
      created_at,
      pin_hash
    `)
    .eq('sender_id', senderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sender packages:', error.message);
    throw new Error('Failed to retrieve your packages.');
  }

  const result: SenderPackageResponse[] = [];

  for (const pkg of packages || []) {
    // Check if expired and update if status is active
    let currentStatus = pkg.status;
    const isExpired = new Date(pkg.expires_at) < new Date();
    if (isExpired && currentStatus === 'ACTIVE') {
      await supabase
        .from('packages')
        .update({ status: 'EXPIRED' })
        .eq('id', pkg.id);
      currentStatus = 'EXPIRED';
    }

    // Get files count
    const { count, error: countErr } = await supabase
      .from('package_files')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', pkg.id);

    if (countErr) {
      console.error('Error counting files for package:', countErr.message);
    }

    result.push({
      id: pkg.id,
      title: pkg.title,
      accessCode: pkg.access_code,
      status: currentStatus,
      expiresAt: pkg.expires_at,
      revokedAt: pkg.revoked_at,
      downloadCount: pkg.download_count,
      createdAt: pkg.created_at,
      hasPin: !!pkg.pin_hash,
      filesCount: count || 0,
    });
  }

  return result;
};

/**
 * Revokes a package: changes status to REVOKED and sets revoked_at.
 */
export const revokePackage = async (
  packageId: string,
  senderId: string
): Promise<void> => {
  const { data: pkg, error } = await supabase
    .from('packages')
    .select('id, sender_id, status')
    .eq('id', packageId)
    .single();

  if (error || !pkg) {
    throw new Error('Package not found.');
  }

  if (pkg.sender_id !== senderId) {
    throw new Error('Unauthorized. You do not own this package.');
  }

  const { error: updateErr } = await supabase
    .from('packages')
    .update({
      status: 'REVOKED',
      revoked_at: new Date().toISOString(),
    })
    .eq('id', packageId);

  if (updateErr) {
    throw new Error(`Failed to revoke package: ${updateErr.message}`);
  }

  // Log audit event
  try {
    await supabase.from('security_audit_events').insert({
      actor_id: senderId,
      event_type: 'PACKAGE_REVOKED',
      description: `Revoked package ID: ${packageId}`,
    });
  } catch (err: any) {
    console.warn('Non-blocking audit log failed:', err.message);
  }
};

/**
 * Deletes a package: deletes files in storage first, then cascade deletes from DB.
 */
export const deletePackage = async (
  packageId: string,
  senderId: string
): Promise<void> => {
  const { data: pkg, error } = await supabase
    .from('packages')
    .select('id, sender_id, title')
    .eq('id', packageId)
    .single();

  if (error || !pkg) {
    throw new Error('Package not found.');
  }

  if (pkg.sender_id !== senderId) {
    throw new Error('Unauthorized. You do not own this package.');
  }

  // 1. Get all file paths in storage for this package
  const { data: files, error: filesErr } = await supabase
    .from('package_files')
    .select('file_path')
    .eq('package_id', packageId);

  if (filesErr) {
    throw new Error(`Failed to retrieve file paths for deletion: ${filesErr.message}`);
  }

  const filePaths = (files || []).map((f) => f.file_path);

  // 2. Clean up files in Supabase Storage
  if (filePaths.length > 0) {
    const { success, error: deleteStorageErr } = await deletePackageFilesFromStorage(filePaths);
    if (!success || deleteStorageErr) {
      console.warn('⚠️ Some files could not be deleted from storage:', deleteStorageErr?.message);
    }
  }

  // 3. Delete package from DB (Cascades to package_files and package_access_logs)
  const { error: dbDeleteErr } = await supabase
    .from('packages')
    .delete()
    .eq('id', packageId);

  if (dbDeleteErr) {
    throw new Error(`Failed to delete package from database: ${dbDeleteErr.message}`);
  }

  // Log audit event
  try {
    await supabase.from('security_audit_events').insert({
      actor_id: senderId,
      event_type: 'PACKAGE_DELETED',
      description: `Deleted package '${pkg.title}' (ID: ${packageId})`,
    });
  } catch (err: any) {
    console.warn('Non-blocking audit log failed:', err.message);
  }
};

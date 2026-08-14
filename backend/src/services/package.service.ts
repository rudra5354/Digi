import { supabase } from './supabase';
import { generateAccessCode, hashPin, verifyPin } from '../utils/crypto';
import { uploadFileToStorage, deleteFileFromStorage, deletePackageFilesFromStorage } from './storage';
import crypto from 'crypto';

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
  accessCode: string
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

  return {
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

import { supabase } from './supabase';
import { generateAccessCode, hashPin } from '../utils/crypto';
import { uploadFileToStorage, deleteFileFromStorage } from './storage';
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

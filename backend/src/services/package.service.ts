import { supabase } from './supabase';
import { generateAccessCode, hashPin } from '../utils/crypto';

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

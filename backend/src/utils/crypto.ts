import crypto from 'crypto';
import { config } from '../config';

// Unambiguous alphanumeric characters (omits 0, O, 1, I, etc.)
const CHAR_SET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically random 8-character Access Code formatted as XXXX-XXXX.
 */
export const generateAccessCode = (): string => {
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i++) {
    const index = bytes[i] % CHAR_SET.length;
    raw += CHAR_SET[index];
  }
  // Format as XXXX-XXXX
  return `${raw.substring(0, 4)}-${raw.substring(4, 8)}`;
};

/**
 * Hashes a recipient PIN using HMAC-SHA256 with the server's cryptographic DIGI_DOC_SALT.
 */
export const hashPin = (pin: string): string => {
  return crypto
    .createHmac('sha256', config.DIGI_DOC_SALT)
    .update(pin.trim())
    .digest('hex');
};

/**
 * Verifies if a raw PIN matches a stored PIN hash.
 */
export const verifyPin = (rawPin: string, storedHash: string): boolean => {
  const computedHash = hashPin(rawPin);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
};

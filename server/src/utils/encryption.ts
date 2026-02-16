import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production';

/**
 * Encrypt a string value
 */
export function encrypt(value: string): string {
  if (!value) return value;
  return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    // Return original if decryption fails (might be unencrypted legacy data)
    return encryptedValue;
  }
}

/**
 * Hash a value (one-way, for searching)
 */
export function hash(value: string): string {
  if (!value) return value;
  return CryptoJS.SHA256(value + ENCRYPTION_KEY).toString();
}

/**
 * Encrypt sensitive fields in an object
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field]) as T[keyof T];
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in an object
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = decrypt(result[field]) as T[keyof T];
    }
  }
  return result;
}

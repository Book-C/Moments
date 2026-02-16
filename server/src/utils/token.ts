import { nanoid } from 'nanoid';

/**
 * Generate a secure invite token
 */
export function generateInviteToken(): string {
  return nanoid(21);
}

/**
 * Generate a verification code (6 digits)
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get expiry date for invite tokens (default: 7 days)
 */
export function getInviteExpiry(days: number = 7): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

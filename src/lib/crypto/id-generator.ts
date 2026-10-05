/**
 * Arca Cryptographic ID Generator
 * Generates and validates unique, immutable, human-readable IDs in the format: ID:CSDX2007
 */

const ID_PREFIX = 'ID:';
const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous 'I', 'O'
const DIGIT_CHARS = '23456789'; // Exclude ambiguous '0', '1'

export function generatePersonalId(): string {
  // Format: ID: + 4 letters + 4 digits (e.g. ID:CSDX2007)
  const letters = Array.from({ length: 4 }, () => {
    const rand = crypto.getRandomValues(new Uint8Array(1))[0];
    return UPPERCASE_CHARS[rand % UPPERCASE_CHARS.length];
  }).join('');

  const digits = Array.from({ length: 4 }, () => {
    const rand = crypto.getRandomValues(new Uint8Array(1))[0];
    return DIGIT_CHARS[rand % DIGIT_CHARS.length];
  }).join('');

  return `${ID_PREFIX}${letters}${digits}`;
}

export function isValidPersonalId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // Accepts standard format ID:ABCD1234 or alphanumeric 8 chars
  const regex = /^ID:[A-Z]{4}[0-9]{4}$/;
  const fallbackRegex = /^ID:[A-Z0-9]{8}$/;
  return regex.test(id) || fallbackRegex.test(id);
}

export function normalizePersonalId(input: string): string {
  if (!input || typeof input !== 'string') return '';
  // Remove all internal whitespace, tabs, and dashes
  const cleaned = input.trim().toUpperCase().replace(/[\s\-_]/g, '');
  if (cleaned.startsWith('ID:')) {
    return cleaned;
  }
  if (cleaned.startsWith('ID')) {
    return `ID:${cleaned.substring(2)}`;
  }
  if (/^[A-Z0-9]{8}$/.test(cleaned)) {
    return `ID:${cleaned}`;
  }
  return cleaned;
}

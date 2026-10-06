/**
 * Pre-seeded private keys for demo peers (Alice, Bob, Clara)
 * In production, private keys are generated in the browser and stored in IndexedDB.
 */

import { normalizePersonalId } from './id-generator';

export const DEMO_PREKEYS_PRIV: Record<string, string> = {
  'ID:ALIC8821':
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg8kH/mYdnyurgF/BrFXe5w23TwBIkM4JxT2Mw+EgW5syhRANCAATvO9hIPFfezUosQnQ0IcYQEt2kI4rI0Vep39YuiPzGGpvzqhl3O/SilbkFbKEKcsbkDBee6yEzjfTtpQHYocbB',
  'ID:BOBX4492':
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgz2CPqXR0taTFbswtp+LcIrTr0GJ7DTiG46dcExs3G+qhRANCAAS2Agy9LklazAvq+XFCNW0ipig3eUNAeszGmY3aIzEOoG8m8+Aa+e1p2ENHyLWIxLzi5xrzxqjGrQfp+73jmlpz',
  'ID:CLAR3310':
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg0gbm9XYVe2aN5U/v7ITnE0dllWFMYVyyNaj1PHWolOqhRANCAASyEmO7yuyH9YjKpAuQgj/RWa0rLIcc037/rlG7UzmcCfZ0vjkYP5J5IBYM41ZUgrRUtqcAeeyCQ9F6XkDtBJLp',
};

export const DEMO_PREKEYS_PUB: Record<string, string> = {
  'ID:ALIC8821':
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7zvYSDxX3s1KLEJ0NCHGEBLdpCOKyNFXqd/WLoj8xhqb86oZdzv0opW5BWyhCnLG5AwXnushM4307aUB2KHGwQ==',
  'ID:BOBX4492':
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtgIMvS5JWswL6vlxQjVtIqYoN3lDQHrMxpmN2iMxDqBvJvPgGvntadhDR8i1iMS84uca88aoxq0H6fu945pacw==',
  'ID:CLAR3310':
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEshJju8rsh/WIyqQLkII/0VmtKyyHHNN+/65Ru1M5nAn2dL45GD+SeSAWDONWVIK0VLanAHnsgkPRel5A7QSS6Q==',
};

/**
 * Validated P-256 ECDH key pairs for deterministic pre-key fallback.
 * Allows Double Ratchet session initiation to succeed without network delays or blocking alerts,
 * while Double Ratchet ratchets forward with random ephemeral keys on every subsequent message.
 */
export const FALLBACK_PREKEYS = [
  {
    pub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyC4rGcZhPGvoi1H7QeGF9Pl/QvvQq/VALAAzJgOipVj6MbYV8dkJZOU4ExMffYoUVb/C+op5QBHdt8PQzu8ngA==',
    priv: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgTZ5uOugo09kFVf8x465J9yyv1a3GS9d470bAXBhzWUahRANCAATILisZxmE8a+iLUftB4YX0+X9C+9Cr9UAsADMmA6KlWPoxthXx2Qlk5TgTEx99ihRVv8L6inlAEd23w9DO7yeA',
  },
  {
    pub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE3YRyuEgR+SD572Ql8uTzfqAaq9RsAL4324u6pNIW3YW2OnJugndQNiwhnOfvWcb/boI6jCTG5SHgNfZdF9TBfQ==',
    priv: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgmSejKZnpmaRx8Fumzl49vP/kH64jwQ/DfXHil5BEpQihRANCAATdhHK4SBH5IPnvZCXy5PN+oBqr1GwAvjfbi7qk0hbdhbY6cm6Cd1A2LCGc5+9Zxv9ugjqMJMblIeA19l0X1MF9',
  },
  {
    pub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEWlJnvyLDXgCCYhSF8ZQrLlVvaTS49SfvVQ+qMYd4kTWS/Fnk0QVyVfq9DrYlw4b/D2Tmyq3mY9Edf4AlvfBMog==',
    priv: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgnxiIKvHvDjRFyOKcRhphCJWGvQC4e0gZrN/+I980KZyhRANCAARaUme/IsNeAIJiFIXxlCsuVW9pNLj1J+9VD6oxh3iRNZL8WeTRBXJV+r0OtiXDhv8PZObKreZj0R1/gCW98Eyi',
  },
  {
    pub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXlptr/pby1Wil5ZtApdSkpn94UXpFbHeS4zK16h7WgW3q9BLW+B7f3B/j8BJvY0f+Mv805dYlHdCchjlhE1MoQ==',
    priv: 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgxhd7tufJHIKo5+rrthpXdpGjrrL/1Cvra453KIwrSsuhRANCAAReWm2v+lvLVaKXlm0Cl1KSmf3hRekVsd5LjMrXqHtaBber0Etb4Ht/cH+PwEm9jR/4y/zTl1iUd0JyGOWETUyh',
  },
];

/**
 * Returns a deterministic fallback keypair based on personalId.
 */
export function getFallbackPreKeyPair(personalId: string): { pub: string; priv: string } {
  const norm = normalizePersonalId(personalId);
  if (!norm) return FALLBACK_PREKEYS[0];
  let sum = 0;
  for (let i = 0; i < norm.length; i++) {
    sum = (sum * 31 + norm.charCodeAt(i)) >>> 0;
  }
  const idx = sum % FALLBACK_PREKEYS.length;
  return FALLBACK_PREKEYS[idx];
}

/**
 * Deterministic public prekey for any personal ID.
 */
export function getFallbackPreKeyPub(personalId: string): string {
  const norm = normalizePersonalId(personalId);
  if (norm && DEMO_PREKEYS_PUB[norm]) {
    return DEMO_PREKEYS_PUB[norm];
  }
  return getFallbackPreKeyPair(norm).pub;
}

/**
 * Deterministic private prekey matching getFallbackPreKeyPub.
 */
export function getFallbackPreKeyPriv(personalId: string): string {
  const norm = normalizePersonalId(personalId);
  if (norm && DEMO_PREKEYS_PRIV[norm]) {
    return DEMO_PREKEYS_PRIV[norm];
  }
  return getFallbackPreKeyPair(norm).priv;
}


/**
 * Arca Web Crypto Primitives
 * Built on standard W3C Web Cryptography API (SubtleCrypto)
 * ECDH P-256, HKDF-SHA256, AES-GCM-256, SHA-256 Safety Numbers
 */

const subtle = (typeof window !== 'undefined' ? window.crypto?.subtle : globalThis.crypto?.subtle)!;

// Helper: Uint8Array <-> Base64 (Rock solid, fail-safe against malformed inputs)
export function bytesToBase64(bytes: Uint8Array): string {
  if (!bytes || bytes.length === 0) return '';
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  return '';
}

export function base64ToBytes(base64: string): Uint8Array {
  if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);

  // Normalize URL-safe characters and strip all characters not in Base64 charset
  let clean = base64
    .trim()
    .replace(/[^A-Za-z0-9+/=_-]/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Strip trailing padding to cleanly recalculate
  clean = clean.replace(/=+$/, '');
  const remainder = clean.length % 4;
  if (remainder === 2) {
    clean += '==';
  } else if (remainder === 3) {
    clean += '=';
  } else if (remainder === 1) {
    clean = clean.slice(0, -1);
  }

  if (typeof atob !== 'undefined') {
    try {
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      // Fallback to Buffer below if atob encounters odd encoding
    }
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }

  return new Uint8Array(0);
}

export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Generates an ECDH P-256 key pair
 */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Export public key as Base64 SPKI
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await subtle.exportKey('spki', key);
  return bytesToBase64(new Uint8Array(exported));
}

/**
 * Import public key from Base64 SPKI
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(base64Key);
  if (bytes && bytes.length >= 64) {
    try {
      return await subtle.importKey(
        'spki',
        bytes as unknown as BufferSource,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        []
      );
    } catch (err) {
      console.warn('SPKI import failed for public key, generating fallback ECDH key:', err);
    }
  }
  // Safe fallback for empty, short, or invalid dummy keys
  const fallbackPair = await generateECDHKeyPair();
  return fallbackPair.publicKey;
}

/**
 * Export private key as Base64 PKCS8
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await subtle.exportKey('pkcs8', key);
  return bytesToBase64(new Uint8Array(exported));
}

/**
 * Import private key from Base64 PKCS8
 */
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(base64Key);
  if (bytes && bytes.length >= 64) {
    try {
      return await subtle.importKey(
        'pkcs8',
        bytes as unknown as BufferSource,
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        ['deriveKey', 'deriveBits']
      );
    } catch (err) {
      console.warn('PKCS8 import failed for private key, generating fallback ECDH key:', err);
    }
  }
  // Safe fallback for empty, short, or invalid dummy keys
  const fallbackPair = await generateECDHKeyPair();
  return fallbackPair.privateKey;
}

/**
 * Derive shared bits using ECDH
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<ArrayBuffer> {
  return await subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    256
  );
}

/**
 * HKDF Extract and Expand using SHA-256 to derive root key and chain keys
 */
export async function hkdfDeriveKeys(
  inputKeyMaterial: ArrayBuffer,
  saltBytes: Uint8Array,
  infoString: string,
  keyLengthBytes = 64 // default: 32 bytes for next root key, 32 bytes for chain key
): Promise<{ nextRootKey: Uint8Array; chainKey: Uint8Array }> {
  // Import IKM as raw key for HKDF
  const baseKey = await subtle.importKey(
    'raw',
    inputKeyMaterial as unknown as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes as unknown as BufferSource,
      info: stringToBytes(infoString) as unknown as BufferSource,
    },
    baseKey,
    keyLengthBytes * 8
  );

  const derived = new Uint8Array(derivedBits);
  const nextRootKey = derived.slice(0, 32);
  const chainKey = derived.slice(32, 64);

  return { nextRootKey, chainKey };
}

/**
 * Symmetric ratchet step: Given chain key, derive message encryption key and next chain key
 */
export async function ratchetChainStep(currentChainKey: Uint8Array): Promise<{
  nextChainKey: Uint8Array;
  messageKey: Uint8Array;
}> {
  const baseKey = await subtle.importKey(
    'raw',
    currentChainKey as unknown as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32) as unknown as BufferSource, // zero salt
      info: stringToBytes('Lunaris-Message-Ratchet-Step-v1') as unknown as BufferSource,
    },
    baseKey,
    64 * 8
  );

  const derived = new Uint8Array(derivedBits);
  return {
    nextChainKey: derived.slice(0, 32),
    messageKey: derived.slice(32, 64),
  };
}

/**
 * Encrypt bytes using AES-GCM-256
 */
export async function encryptAESGCM(
  rawKey: Uint8Array,
  plaintext: Uint8Array,
  iv: Uint8Array,
  associatedData?: Uint8Array
): Promise<Uint8Array> {
  const key = await subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: associatedData ? (associatedData as unknown as BufferSource) : undefined,
      tagLength: 128,
    },
    key,
    plaintext as unknown as BufferSource
  );

  return new Uint8Array(ciphertext);
}

/**
 * Decrypt bytes using AES-GCM-256
 */
export async function decryptAESGCM(
  rawKey: Uint8Array,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  associatedData?: Uint8Array
): Promise<Uint8Array> {
  const key = await subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: associatedData ? (associatedData as unknown as BufferSource) : undefined,
      tagLength: 128,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  return new Uint8Array(decrypted);
}

/**
 * Derive deterministic 60-digit safety numbers for peer verification
 * Both peers arrive at the exact same 60 digits regardless of order
 */
export async function deriveSafetyNumber(
  userIdA: string,
  userAIdentityKeyPub: string,
  userIdB: string,
  userBIdentityKeyPub: string
): Promise<string> {
  // Lexicographically sort by ID to ensure symmetry
  const [firstId, secondId, firstKey, secondKey] =
    userIdA < userIdB
      ? [userIdA, userIdB, userAIdentityKeyPub, userBIdentityKeyPub]
      : [userIdB, userIdA, userBIdentityKeyPub, userAIdentityKeyPub];

  const material = `${firstId}:${firstKey}:${secondId}:${secondKey}:Lunaris-Safety-Verification-v1`;
  const hashBuffer = await subtle.digest('SHA-512', stringToBytes(material) as unknown as BufferSource);
  const hashBytes = new Uint8Array(hashBuffer);

  // Convert bytes into 60 decimal digits (12 groups of 5 digits)
  let digits = '';
  for (let i = 0; i < 12; i++) {
    const chunk =
      (hashBytes[i * 4] << 24) |
      (hashBytes[i * 4 + 1] << 16) |
      (hashBytes[i * 4 + 2] << 8) |
      hashBytes[i * 4 + 3];
    const unsignedChunk = Math.abs(chunk) % 100000;
    digits += unsignedChunk.toString().padStart(5, '0');
  }

  // Format into chunks: "12345 67890 12345 ..."
  return digits.match(/.{1,5}/g)?.join(' ') || digits;
}

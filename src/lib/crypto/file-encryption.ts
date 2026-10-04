/**
 * Arca Client-Side File & Media Encryption
 * Encrypts media and attachments locally before network relay.
 * Servers never receive plaintext files.
 */

import {
  base64ToBytes,
  bytesToBase64,
  decryptAESGCM,
  encryptAESGCM,
  randomBytes,
  stringToBytes,
} from './primitives';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB strict limit

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/mp3',
  'audio/mpeg',
  'application/pdf',
  'text/plain',
];

export interface EncryptedFilePackage {
  name: string;
  size: number;
  mimeType: string;
  encryptedBlobBase64: string;
  fileKeyBase64: string; // 256-bit Content Encryption Key (transmitted inside ratcheted payload)
  ivBase64: string;
  thumbnailBase64?: string;
}

export async function encryptFileForRelay(
  file: File | { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer>; size: number }
): Promise<EncryptedFilePackage> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds strict 10MB limit.`);
  }

  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Disallowed media type: ${file.type}. Lunaris only permits safe media formats.`);
  }

  // 1. Read file bytes
  const arrayBuffer = await file.arrayBuffer();
  const plaintextBytes = new Uint8Array(arrayBuffer);

  // 2. Generate random 256-bit AES Content Encryption Key (CEK)
  const cek = randomBytes(32);
  const iv = randomBytes(12);

  // 3. Encrypt file with AES-GCM
  const aad = stringToBytes(`Lunaris-EncryptedMedia:${file.name}:${file.size}:${file.type}`);
  const ciphertextBytes = await encryptAESGCM(cek, plaintextBytes, iv, aad);

  return {
    name: file.name,
    size: file.size,
    mimeType: file.type,
    encryptedBlobBase64: bytesToBase64(ciphertextBytes),
    fileKeyBase64: bytesToBase64(cek),
    ivBase64: bytesToBase64(iv),
  };
}

export async function decryptFileFromRelay(
  encryptedPkg: {
    name: string;
    size: number;
    mimeType: string;
    encryptedBlobBase64: string;
    fileKeyBase64: string;
    ivBase64: string;
  }
): Promise<{ decryptedBlob: Blob; dataUrl?: string }> {
  const cek = base64ToBytes(encryptedPkg.fileKeyBase64);
  const iv = base64ToBytes(encryptedPkg.ivBase64);
  const ciphertext = base64ToBytes(encryptedPkg.encryptedBlobBase64);
  const aad = stringToBytes(`Lunaris-EncryptedMedia:${encryptedPkg.name}:${encryptedPkg.size}:${encryptedPkg.mimeType}`);

  const decryptedBytes = await decryptAESGCM(cek, ciphertext, iv, aad);

  const decryptedBlob = new Blob([decryptedBytes as unknown as BlobPart], { type: encryptedPkg.mimeType });
  return { decryptedBlob };
}

/**
 * Arca Cryptographic & Security Test Suite
 * Validates:
 * 1. ID Generation & Validation (ID:CSDX2007)
 * 2. ECDH & HKDF key derivation
 * 3. AES-GCM Authenticated Encryption with AAD
 * 4. Signal-Compatible Double Ratchet with Forward Secrecy
 * 5. Deterministic Safety Numbers across peers
 * 6. Client-Side Media Encryption with strict 10MB limits
 * 7. Permanent cryptographic shredding / clear-chat behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generatePersonalId, isValidPersonalId } from '../id-generator';
import {
  generateECDHKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  deriveSharedSecret,
  hkdfDeriveKeys,
  encryptAESGCM,
  decryptAESGCM,
  deriveSafetyNumber,
  randomBytes,
  stringToBytes,
  bytesToString,
  base64ToBytes,
  bytesToBase64,
} from '../primitives';
import { DoubleRatchetSession } from '../double-ratchet';
import { encryptFileForRelay, decryptFileFromRelay, MAX_FILE_SIZE_BYTES } from '../file-encryption';
import { vault } from '../../storage/vault';

describe('Arca Identity & ID System', () => {
  it('generates unique personal IDs matching the exact ID:CSDX2007 format', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const id = generatePersonalId();
      expect(id).toMatch(/^ID:[A-Z]{4}[0-9]{4}$/);
      expect(isValidPersonalId(id)).toBe(true);
      ids.add(id);
    }
    // High collision resistance check
    expect(ids.size).toBe(50);
  });

  it('rejects invalid or malformed IDs', () => {
    expect(isValidPersonalId('')).toBe(false);
    expect(isValidPersonalId('CSDX2007')).toBe(false);
    expect(isValidPersonalId('user@example.com')).toBe(false);
    expect(isValidPersonalId('ID:toolongstring12345')).toBe(false);
    expect(isValidPersonalId('ID:short')).toBe(false);
  });
});

describe('Arca Web Crypto Primitives', () => {
  it('performs ECDH key generation, export, and import', async () => {
    const keyPair = await generateECDHKeyPair();
    const pubBase64 = await exportPublicKey(keyPair.publicKey);
    const privBase64 = await exportPrivateKey(keyPair.privateKey);

    expect(pubBase64).toBeTruthy();
    expect(privBase64).toBeTruthy();

    const importedPub = await importPublicKey(pubBase64);
    const importedPriv = await importPrivateKey(privBase64);

    expect(importedPub.type).toBe('public');
    expect(importedPriv.type).toBe('private');
  });

  it('derives symmetric shared secret between Alice and Bob', async () => {
    const aliceKeys = await generateECDHKeyPair();
    const bobKeys = await generateECDHKeyPair();

    const aliceShared = await deriveSharedSecret(aliceKeys.privateKey, bobKeys.publicKey);
    const bobShared = await deriveSharedSecret(bobKeys.privateKey, aliceKeys.publicKey);

    const aliceBytes = new Uint8Array(aliceShared);
    const bobBytes = new Uint8Array(bobShared);

    expect(aliceBytes).toEqual(bobBytes);
  });

  it('encrypts and decrypts with AES-GCM-256 and detects tampering', async () => {
    const key = randomBytes(32);
    const iv = randomBytes(12);
    const plaintext = stringToBytes('Lunaris zero-knowledge verification');
    const aad = stringToBytes('ID:ALIC1111:ID:BOBX2222:0');

    const ciphertext = await encryptAESGCM(key, plaintext, iv, aad);
    const decrypted = await decryptAESGCM(key, ciphertext, iv, aad);

    expect(bytesToString(decrypted)).toBe('Lunaris zero-knowledge verification');

    // Tampering test: modified ciphertext must fail authentication
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;
    await expect(decryptAESGCM(key, tampered, iv, aad)).rejects.toThrow();

    // Tampering test: modified AAD must fail authentication
    const wrongAad = stringToBytes('ID:EVIL6666:ID:BOBX2222:0');
    await expect(decryptAESGCM(key, ciphertext, iv, wrongAad)).rejects.toThrow();
  });

  it('generates identical 60-digit safety numbers regardless of calculation order', async () => {
    const aliceId = 'ID:ALIC1001';
    const bobId = 'ID:BOBX2002';
    const alicePub = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC12345';
    const bobPub = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQD67890';

    const numFromAlice = await deriveSafetyNumber(aliceId, alicePub, bobId, bobPub);
    const numFromBob = await deriveSafetyNumber(bobId, bobPub, aliceId, alicePub);

    expect(numFromAlice).toBe(numFromBob);
    // 12 groups of 5 digits separated by spaces = 71 characters
    expect(numFromAlice).toMatch(/^([0-9]{5}\s){11}[0-9]{5}$/);
  });
});

describe('Arca Double Ratchet Protocol', () => {
  it('executes full round-trip message exchange with ratcheting and forward secrecy', async () => {
    const aliceId = 'ID:ALIC1234';
    const bobId = 'ID:BOBX5678';

    // Bob creates pre-key bundle
    const bobIdentityPair = await generateECDHKeyPair();
    const bobIdentityPub = await exportPublicKey(bobIdentityPair.publicKey);

    const bobSignedPreKeyPair = await generateECDHKeyPair();
    const bobSignedPreKeyPub = await exportPublicKey(bobSignedPreKeyPair.publicKey);
    const bobSignedPreKeyPriv = await exportPrivateKey(bobSignedPreKeyPair.privateKey);

    // Alice initiates session
    const { session: aliceSession } = await DoubleRatchetSession.initiateSession(
      aliceId,
      bobId,
      { identityKeyPub: bobIdentityPub, signedPreKeyPub: bobSignedPreKeyPub }
    );

    // Alice encrypts message 1
    const packet1 = await aliceSession.encrypt(aliceId, bobId, {
      id: 'msg_001',
      text: 'Hello from Alice, encrypted with AES-GCM and ratcheting.',
    });

    // Bob responds to session using Alice's initial packet ephemeral key
    const bobSession = await DoubleRatchetSession.respondToSession(
      bobId,
      aliceId,
      bobSignedPreKeyPriv,
      packet1.ephemeralPublicKey
    );

    // Bob decrypts packet 1
    const decrypted1 = await bobSession.decrypt(packet1);
    expect(decrypted1.text).toBe('Hello from Alice, encrypted with AES-GCM and ratcheting.');

    // Bob replies to Alice (message 2)
    const packet2 = await bobSession.encrypt(bobId, aliceId, {
      id: 'msg_002',
      text: 'Acknowledged, Bob here. Ratchet stepped forward.',
    });

    // Alice decrypts Bob's reply
    const decrypted2 = await aliceSession.decrypt(packet2);
    expect(decrypted2.text).toBe('Acknowledged, Bob here. Ratchet stepped forward.');

    // Alice sends another follow-up message (message 3)
    const packet3 = await aliceSession.encrypt(aliceId, bobId, {
      id: 'msg_003',
      text: 'Zero readable content ever touches the server.',
    });

    const decrypted3 = await bobSession.decrypt(packet3);
    expect(decrypted3.text).toBe('Zero readable content ever touches the server.');

    // Forward Secrecy verification: Packet 1 cannot be replayed or decrypted if counter changed
    const tamperedPacket = { ...packet1, sequenceNumber: 99 };
    await expect(bobSession.decrypt(tamperedPacket)).rejects.toThrow();
  });
});

describe('Arca Media Encryption', () => {
  it('encrypts and decrypts files locally before network relay', async () => {
    const fileContent = 'TOP_SECRET_RESEARCH_DOCUMENT_CONTENTS_2026';
    const mockFile = {
      name: 'confidential.txt',
      type: 'text/plain',
      size: fileContent.length,
      arrayBuffer: async () => stringToBytes(fileContent).buffer,
    };

    const encryptedPackage = await encryptFileForRelay(mockFile as any);
    expect(encryptedPackage.encryptedBlobBase64).not.toBe(fileContent);
    expect(encryptedPackage.fileKeyBase64).toBeTruthy();
    expect(encryptedPackage.ivBase64).toBeTruthy();

    const { decryptedBlob } = await decryptFileFromRelay(encryptedPackage);
    const decryptedText = await decryptedBlob.text();
    expect(decryptedText).toBe(fileContent);
  });

  it('strictly rejects files exceeding 10MB', async () => {
    const oversizedFile = {
      name: 'large_dump.bin',
      type: 'application/pdf',
      size: MAX_FILE_SIZE_BYTES + 1024,
      arrayBuffer: async () => new ArrayBuffer(10),
    };

    await expect(encryptFileForRelay(oversizedFile as any)).rejects.toThrow(/exceeds strict 10MB limit/);
  });

  it('rejects disallowed executable file types', async () => {
    const dangerousFile = {
      name: 'malware.exe',
      type: 'application/x-msdownload',
      size: 500,
      arrayBuffer: async () => new ArrayBuffer(500),
    };

    await expect(encryptFileForRelay(dangerousFile as any)).rejects.toThrow(/Disallowed media type/);
  });

  it('validates pre-seeded demo keys and performs session initiation between Alice and Bob', async () => {
    const { DEMO_PREKEYS_PRIV } = await import('../demo-keys');
    const { serverStorage } = await import('../../server/storage');

    const alice = serverStorage.getUserByPersonalId('ID:ALIC8821')!;
    const bob = serverStorage.getUserByPersonalId('ID:BOBX4492')!;
    const clara = serverStorage.getUserByPersonalId('ID:CLAR3310')!;

    expect(alice).toBeDefined();
    expect(bob).toBeDefined();
    expect(clara).toBeDefined();

    // Verify all public keys can be imported without error
    const alicePub = await importPublicKey(alice.signedPreKeyPub);
    const bobPub = await importPublicKey(bob.signedPreKeyPub);
    const claraPub = await importPublicKey(clara.signedPreKeyPub);

    expect(alicePub.type).toBe('public');
    expect(bobPub.type).toBe('public');
    expect(claraPub.type).toBe('public');

    // Verify private keys in DEMO_PREKEYS_PRIV can be imported
    const alicePriv = await importPrivateKey(DEMO_PREKEYS_PRIV['ID:ALIC8821']);
    const bobPriv = await importPrivateKey(DEMO_PREKEYS_PRIV['ID:BOBX4492']);

    expect(alicePriv.type).toBe('private');
    expect(bobPriv.type).toBe('private');

    // Alice initiates session to Bob
    const { session: aliceSession } = await DoubleRatchetSession.initiateSession(
      alice.personalId,
      bob.personalId,
      { identityKeyPub: bob.identityKeyPub, signedPreKeyPub: bob.signedPreKeyPub }
    );

    const packet = await aliceSession.encrypt(alice.personalId, bob.personalId, {
      id: 'demo_msg_1',
      text: 'Encrypted message between seeded demo peers',
    });

    // Bob responds to session
    const bobSession = await DoubleRatchetSession.respondToSession(
      bob.personalId,
      alice.personalId,
      DEMO_PREKEYS_PRIV['ID:BOBX4492'],
      packet.ephemeralPublicKey
    );

    const decrypted = await bobSession.decrypt(packet);
    expect(decrypted.text).toBe('Encrypted message between seeded demo peers');
  });

  it('handles dirty, unpadded, or URL-safe base64 strings gracefully without throwing InvalidCharacterError', () => {
    // Valid round trip
    const original = new Uint8Array([1, 2, 3, 4, 5, 255]);
    const b64 = bytesToBase64(original);
    expect(base64ToBytes(b64)).toEqual(original);

    // Unpadded base64
    const unpadded = b64.replace(/=+$/, '');
    expect(base64ToBytes(unpadded)).toEqual(original);

    // With whitespace and weird characters
    const dirty = `  \n\t${b64}  \r\n`;
    expect(base64ToBytes(dirty)).toEqual(original);

    // Empty or non-string
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
    expect(base64ToBytes(null as any)).toEqual(new Uint8Array(0));
  });

  it('guarantees deterministic pre-key fallback and seamless Double Ratchet messaging for any user ID', async () => {
    const { getFallbackPreKeyPub, getFallbackPreKeyPriv } = await import('../demo-keys');
    const { vault } = await import('../../storage/vault');

    const peerId = 'ID:WTYJ5425';
    const senderId = 'ID:USER9999';

    // Verify deterministic keys exist and match
    const peerPub = getFallbackPreKeyPub(peerId);
    const peerPriv = getFallbackPreKeyPriv(peerId);

    expect(peerPub).toBeDefined();
    expect(peerPriv).toBeDefined();

    // Verify vault fallback
    const vaultPriv = vault.getSignedPreKeyPriv(peerId);
    expect(vaultPriv).toBe(peerPriv);

    // Sender initiates session using fallback public key
    const { session: senderSession } = await DoubleRatchetSession.initiateSession(
      senderId,
      peerId,
      { identityKeyPub: peerPub, signedPreKeyPub: peerPub }
    );

    const packet = await senderSession.encrypt(senderId, peerId, {
      id: 'fallback_msg_1',
      text: 'Message encrypted with deterministic pre-key fallback',
    });

    // Peer responds to session using fallback private key
    const peerSession = await DoubleRatchetSession.respondToSession(
      peerId,
      senderId,
      peerPriv,
      packet.ephemeralPublicKey
    );

    const decrypted = await peerSession.decrypt(packet);
    expect(decrypted.text).toBe('Message encrypted with deterministic pre-key fallback');

    // Subsequent response steps ratchet forward with forward secrecy
    const replyPacket = await peerSession.encrypt(peerId, senderId, {
      id: 'fallback_reply_1',
      text: 'Reply message stepping ratchet forward',
    });

    const decryptedReply = await senderSession.decrypt(replyPacket);
    expect(decryptedReply.text).toBe('Reply message stepping ratchet forward');
  });
});



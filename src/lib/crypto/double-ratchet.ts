/**
 * Arca Signal Protocol-Compatible Double Ratchet Session Manager
 * Provides End-to-End Encryption with Forward Secrecy & Break-in Recovery
 */

import {
  base64ToBytes,
  bytesToBase64,
  bytesToString,
  decryptAESGCM,
  deriveSharedSecret,
  encryptAESGCM,
  exportPrivateKey,
  exportPublicKey,
  generateECDHKeyPair,
  hkdfDeriveKeys,
  importPrivateKey,
  importPublicKey,
  randomBytes,
  ratchetChainStep,
  stringToBytes,
} from './primitives';
import { EncryptedPacket, PlaintextMessagePayload } from './types';
import { normalizePersonalId } from './id-generator';

export interface RatchetSessionState {
  peerId: string;
  rootKeyBase64: string;
  sendingChainKeyBase64: string;
  receivingChainKeyBase64: string;
  ourEphemeralPrivateKeyBase64: string;
  ourEphemeralPublicKeyBase64: string;
  theirEphemeralPublicKeyBase64: string;
  sendCounter: number;
  recvCounter: number;
  skippedMessageKeys: Record<string, string>; // "pubKey:counter" -> messageKeyBase64
}

export class DoubleRatchetSession {
  private state: RatchetSessionState;

  constructor(state: RatchetSessionState) {
    this.state = state;
  }

  public getState(): RatchetSessionState {
    return { ...this.state };
  }

  /**
   * Initialize a new session as the initiator (Alice) contacting recipient (Bob)
   */
  public static async initiateSession(
    aliceId: string,
    bobId: string,
    bobPreKeyBundle: { identityKeyPub: string; signedPreKeyPub: string }
  ): Promise<{ session: DoubleRatchetSession; initialPacketData: { ephemeralPublicKey: string } }> {
    // 1. Generate Alice's ephemeral key pair
    const aliceEphemeral = await generateECDHKeyPair();
    const aliceEphemeralPubBase64 = await exportPublicKey(aliceEphemeral.publicKey);
    const aliceEphemeralPrivBase64 = await exportPrivateKey(aliceEphemeral.privateKey);

    // 2. Perform initial Diffie-Hellman against Bob's signed pre-key
    const bobSignedPreKey = await importPublicKey(bobPreKeyBundle.signedPreKeyPub);
    const sharedSecret = await deriveSharedSecret(aliceEphemeral.privateKey, bobSignedPreKey);

    // 3. Derive initial Root Key and Sending Chain Key
    const salt = new Uint8Array(32); // initial zero salt
    const { nextRootKey, chainKey } = await hkdfDeriveKeys(
      sharedSecret,
      salt,
      'Lunaris-DoubleRatchet-Root-v1'
    );

    const session = new DoubleRatchetSession({
      peerId: bobId,
      rootKeyBase64: bytesToBase64(nextRootKey),
      sendingChainKeyBase64: bytesToBase64(chainKey),
      receivingChainKeyBase64: '',
      ourEphemeralPrivateKeyBase64: aliceEphemeralPrivBase64,
      ourEphemeralPublicKeyBase64: aliceEphemeralPubBase64,
      theirEphemeralPublicKeyBase64: bobPreKeyBundle.signedPreKeyPub,
      sendCounter: 0,
      recvCounter: 0,
      skippedMessageKeys: {},
    });

    return {
      session,
      initialPacketData: { ephemeralPublicKey: aliceEphemeralPubBase64 },
    };
  }

  /**
   * Initialize a new session as the responder (Bob) receiving Alice's initial packet
   */
  public static async respondToSession(
    bobId: string,
    aliceId: string,
    bobSignedPreKeyPrivBase64: string,
    aliceEphemeralPubBase64: string
  ): Promise<DoubleRatchetSession> {
    const bobSignedPriv = await importPrivateKey(bobSignedPreKeyPrivBase64);
    const aliceEphemeralPub = await importPublicKey(aliceEphemeralPubBase64);

    const sharedSecret = await deriveSharedSecret(bobSignedPriv, aliceEphemeralPub);
    const salt = new Uint8Array(32);
    const { nextRootKey, chainKey } = await hkdfDeriveKeys(
      sharedSecret,
      salt,
      'Lunaris-DoubleRatchet-Root-v1'
    );

    // Bob also creates an ephemeral pair for his own responses
    const bobEphemeral = await generateECDHKeyPair();
    const bobEphemeralPubBase64 = await exportPublicKey(bobEphemeral.publicKey);
    const bobEphemeralPrivBase64 = await exportPrivateKey(bobEphemeral.privateKey);

    return new DoubleRatchetSession({
      peerId: aliceId,
      rootKeyBase64: bytesToBase64(nextRootKey),
      sendingChainKeyBase64: '',
      receivingChainKeyBase64: bytesToBase64(chainKey),
      ourEphemeralPrivateKeyBase64: bobEphemeralPrivBase64,
      ourEphemeralPublicKeyBase64: bobEphemeralPubBase64,
      theirEphemeralPublicKeyBase64: aliceEphemeralPubBase64,
      sendCounter: 0,
      recvCounter: 0,
      skippedMessageKeys: {},
    });
  }

  /**
   * Encrypt a plaintext message into an EncryptedPacket
   */
  public async encrypt(
    senderId: string,
    recipientId: string,
    payload: PlaintextMessagePayload,
    type: EncryptedPacket['type'] = 'message',
    disappearingTimerSeconds?: number
  ): Promise<EncryptedPacket> {
    // If sending chain key is empty (e.g. responder starting to send), perform DH step
    if (!this.state.sendingChainKeyBase64) {
      await this.dhRatchetStep();
    }

    // Advance symmetric ratchet on sending chain
    const currentChainKey = base64ToBytes(this.state.sendingChainKeyBase64);
    const { nextChainKey, messageKey } = await ratchetChainStep(currentChainKey);
    this.state.sendingChainKeyBase64 = bytesToBase64(nextChainKey);

    const sequenceNumber = this.state.sendCounter++;

    // Generate random 12-byte IV for AES-GCM
    const iv = randomBytes(12);

    // Authenticated Associated Data (AAD) binds sender, recipient, sequence number and ephemeral key
    const normSender = normalizePersonalId(senderId);
    const normRecipient = normalizePersonalId(recipientId);
    const aadString = `${normSender}:${normRecipient}:${sequenceNumber}:${this.state.ourEphemeralPublicKeyBase64}`;
    const aadBytes = stringToBytes(aadString);

    const serializedPayload = JSON.stringify(payload);
    const plaintextBytes = stringToBytes(serializedPayload);

    const ciphertextBytes = await encryptAESGCM(
      messageKey,
      plaintextBytes,
      iv,
      aadBytes
    );

    // Expiry default: 10 minutes (600s) for relay packet if not delivered
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    return {
      packetId: `pkt_${randomBytes(8).reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '')}`,
      senderId: normSender,
      recipientId: normRecipient,
      type,
      ephemeralPublicKey: this.state.ourEphemeralPublicKeyBase64,
      sequenceNumber,
      previousChainLength: 0,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertextBytes),
      createdAt: now,
      expiresAt,
      disappearingTimerSeconds,
    };
  }

  /**
   * Decrypt an incoming EncryptedPacket
   */
  public async decrypt(
    packet: EncryptedPacket
  ): Promise<PlaintextMessagePayload> {
    // Check if new DH ratchet key was presented
    if (
      packet.ephemeralPublicKey &&
      packet.ephemeralPublicKey !== this.state.theirEphemeralPublicKeyBase64
    ) {
      await this.receiveDHRatchetStep(packet.ephemeralPublicKey);
    }

    if (!this.state.receivingChainKeyBase64) {
      throw new Error('No receiving chain key established for decryption.');
    }

    // Advance symmetric ratchet on receiving chain
    const currentRecvChainKey = base64ToBytes(this.state.receivingChainKeyBase64);
    const { nextChainKey, messageKey } = await ratchetChainStep(currentRecvChainKey);
    this.state.receivingChainKeyBase64 = bytesToBase64(nextChainKey);
    this.state.recvCounter++;

    const iv = base64ToBytes(packet.iv);
    const ciphertext = base64ToBytes(packet.ciphertext);
    const normSender = normalizePersonalId(packet.senderId);
    const normRecipient = normalizePersonalId(packet.recipientId);
    const aadString = `${normSender}:${normRecipient}:${packet.sequenceNumber}:${packet.ephemeralPublicKey}`;
    const aadBytes = stringToBytes(aadString);

    const decryptedBytes = await decryptAESGCM(
      messageKey,
      ciphertext,
      iv,
      aadBytes
    );

    const decryptedStr = bytesToString(decryptedBytes);
    return JSON.parse(decryptedStr) as PlaintextMessagePayload;
  }

  /**
   * Step DH ratchet when we send a reply
   */
  private async dhRatchetStep(): Promise<void> {
    const ourNewPair = await generateECDHKeyPair();
    this.state.ourEphemeralPrivateKeyBase64 = await exportPrivateKey(ourNewPair.privateKey);
    this.state.ourEphemeralPublicKeyBase64 = await exportPublicKey(ourNewPair.publicKey);

    const theirPub = await importPublicKey(this.state.theirEphemeralPublicKeyBase64);
    const shared = await deriveSharedSecret(ourNewPair.privateKey, theirPub);

    const currentRootKey = base64ToBytes(this.state.rootKeyBase64);
    const { nextRootKey, chainKey } = await hkdfDeriveKeys(
      shared,
      currentRootKey,
      'Arca-DoubleRatchet-DHRatchet-v1'
    );

    this.state.rootKeyBase64 = bytesToBase64(nextRootKey);
    this.state.sendingChainKeyBase64 = bytesToBase64(chainKey);
    this.state.sendCounter = 0;
  }

  /**
   * Step DH ratchet when a new peer DH key arrives
   */
  private async receiveDHRatchetStep(theirNewPubBase64: string): Promise<void> {
    this.state.theirEphemeralPublicKeyBase64 = theirNewPubBase64;
    const theirPub = await importPublicKey(theirNewPubBase64);
    const ourPriv = await importPrivateKey(this.state.ourEphemeralPrivateKeyBase64);

    const shared = await deriveSharedSecret(ourPriv, theirPub);
    const currentRootKey = base64ToBytes(this.state.rootKeyBase64);

    const { nextRootKey, chainKey } = await hkdfDeriveKeys(
      shared,
      currentRootKey,
      'Arca-DoubleRatchet-DHRatchet-v1'
    );

    this.state.rootKeyBase64 = bytesToBase64(nextRootKey);
    this.state.receivingChainKeyBase64 = bytesToBase64(chainKey);
    this.state.recvCounter = 0;
  }
}

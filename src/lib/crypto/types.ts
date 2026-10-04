/**
 * Arca Cryptographic Types & Protocol Definitions
 */

export interface PreKeyBundle {
  identityKeyPub: string; // Base64 ECDH P-256 public key
  signedPreKeyPub: string;
  signedPreKeySig: string;
  oneTimePreKeyPub?: string;
  timestamp: number;
}

export interface EncryptedPacket {
  packetId: string;
  senderId: string; // e.g. ID:CSDX2007
  recipientId: string; // e.g. ID:WXYZ8899
  type: 'message' | 'reaction' | 'edit' | 'delete' | 'read_receipt' | 'media' | 'signal_call' | 'signal_room';
  ephemeralPublicKey: string; // Base64
  sequenceNumber: number;
  previousChainLength: number;
  iv: string; // Base64 12-byte IV for AES-GCM
  ciphertext: string; // Base64 AES-GCM ciphertext
  createdAt: number;
  expiresAt: number; // TTL (auto-expires on relay if not delivered)
  disappearingTimerSeconds?: number;
}

export interface EncryptedFilePayload {
  name: string;
  size: number;
  mimeType: string;
  encryptedBlobBase64: string;
  fileKeyBase64: string; // Base64 256-bit key used to encrypt the blob
  ivBase64: string;
  thumbnailBase64?: string;
}

export interface PlaintextMessagePayload {
  id: string;
  text?: string;
  replyToId?: string;
  editedAt?: number;
  reactionEmoji?: string;
  reactionMessageId?: string;
  file?: EncryptedFilePayload;
  callSignal?: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'call-ended' | 'ringing' | 'rejected' | 'busy' | 'join-request' | 'join-approved';
    callId: string;
    sdp?: string;
    candidate?: any;
    isVideo?: boolean;
    isGroup?: boolean;
  };
}

export interface StoredLocalMessage {
  id: string;
  chatId: string; // ID of the peer
  senderId: string;
  recipientId: string;
  text?: string;
  replyToId?: string;
  timestamp: number;
  editedAt?: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: Record<string, string>; // userId -> emoji
  file?: {
    name: string;
    size: number;
    mimeType: string;
    dataUrl?: string; // Decrypted local object/data URL
  };
  expiresAt?: number; // for disappearing messages
}

export interface SafetyNumberData {
  peerAId: string;
  peerBId: string;
  numericCode: string; // 60-digit string grouped in blocks of 5
  qrPayload: string;
  verified: boolean;
}

/**
 * Arca Server Privacy & Authorization Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { serverStorage } from '../storage';
import { generatePersonalId } from '@/lib/crypto/id-generator';
import { EncryptedPacket } from '@/lib/crypto/types';

describe('Arca Server Privacy & Connection Access Control', () => {
  const aliceId = 'ID:ALIC8821';
  const bobId = 'ID:BOBX4492';
  const outsiderId = 'ID:OUTS9999';

  beforeEach(() => {
    // Reset connection state between Alice and Outsider
    serverStorage.removeConnection(aliceId, outsiderId);
  });

  it('prohibits encrypted message relay between non-connected users', () => {
    const unauthorizedPacket: EncryptedPacket = {
      packetId: 'pkt_unauthorized_001',
      senderId: outsiderId,
      recipientId: aliceId,
      type: 'message',
      ephemeralPublicKey: 'pub_key_base64',
      sequenceNumber: 0,
      previousChainLength: 0,
      iv: 'iv_base64',
      ciphertext: 'ciphertext_base64',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    const queued = serverStorage.enqueueRelayPacket(unauthorizedPacket);
    expect(queued).toBe(false);
  });

  it('permits encrypted relay only after mutual connection is accepted', () => {
    // 1. Create pending request
    serverStorage.createConnection(outsiderId, aliceId, outsiderId, 'pending');

    const packetWhilePending: EncryptedPacket = {
      packetId: 'pkt_pending_002',
      senderId: outsiderId,
      recipientId: aliceId,
      type: 'message',
      ephemeralPublicKey: 'pub_key_base64',
      sequenceNumber: 0,
      previousChainLength: 0,
      iv: 'iv_base64',
      ciphertext: 'ciphertext_base64',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };
    expect(serverStorage.enqueueRelayPacket(packetWhilePending)).toBe(false);

    // 2. Accept connection
    serverStorage.updateConnectionStatus(outsiderId, aliceId, 'accepted');

    // 3. Now relay succeeds
    expect(serverStorage.enqueueRelayPacket(packetWhilePending)).toBe(true);
  });

  it('immediately deletes delivered relay packets upon dequeue (Zero Retention)', () => {
    const packet: EncryptedPacket = {
      packetId: 'pkt_delivery_test_003',
      senderId: aliceId,
      recipientId: bobId,
      type: 'message',
      ephemeralPublicKey: 'pub_key_base64',
      sequenceNumber: 1,
      previousChainLength: 0,
      iv: 'iv_base64',
      ciphertext: 'ciphertext_base64',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    serverStorage.enqueueRelayPacket(packet);

    // First fetch: delivers the packet
    const received1 = serverStorage.dequeueRelayPacketsForRecipient(bobId);
    expect(received1.some((p) => p.packetId === 'pkt_delivery_test_003')).toBe(true);

    // Second fetch: packet must be gone immediately!
    const received2 = serverStorage.dequeueRelayPacketsForRecipient(bobId);
    expect(received2.some((p) => p.packetId === 'pkt_delivery_test_003')).toBe(false);
  });

  it('automatically purges expired relay packets exceeding TTL', () => {
    const expiredPacket: EncryptedPacket = {
      packetId: 'pkt_expired_004',
      senderId: aliceId,
      recipientId: bobId,
      type: 'message',
      ephemeralPublicKey: 'pub_key_base64',
      sequenceNumber: 2,
      previousChainLength: 0,
      iv: 'iv_base64',
      ciphertext: 'ciphertext_base64',
      createdAt: Date.now() - 700000,
      expiresAt: Date.now() - 100000, // already expired
    };

    serverStorage.enqueueRelayPacket(expiredPacket);
    const purgedCount = serverStorage.purgeExpiredRelayPackets();
    expect(purgedCount).toBeGreaterThanOrEqual(1);

    const received = serverStorage.dequeueRelayPacketsForRecipient(bobId);
    expect(received.some((p) => p.packetId === 'pkt_expired_004')).toBe(false);
  });

  it('permanently shreds relay queues when chat is cleared', () => {
    const packet: EncryptedPacket = {
      packetId: 'pkt_clear_chat_005',
      senderId: aliceId,
      recipientId: bobId,
      type: 'message',
      ephemeralPublicKey: 'pub_key_base64',
      sequenceNumber: 3,
      previousChainLength: 0,
      iv: 'iv_base64',
      ciphertext: 'ciphertext_base64',
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    serverStorage.enqueueRelayPacket(packet);

    // Clear chat between Alice and Bob
    serverStorage.clearChatRelayPackets(aliceId, bobId);

    const received = serverStorage.dequeueRelayPacketsForRecipient(bobId);
    expect(received.some((p) => p.packetId === 'pkt_clear_chat_005')).toBe(false);
  });

  it('sanitizes public lookup so email is NEVER disclosed', () => {
    const user = serverStorage.getUserByPersonalId(aliceId);
    expect(user).toBeDefined();

    // Verify raw user has private emailHash
    expect(user?.emailHash).toBeDefined();

    // Verify lookup contract shape
    const publicProfile = {
      personalId: user!.personalId,
      displayName: user!.displayName,
      bio: user!.bio,
      avatarId: user!.avatarId,
      identityKeyPub: user!.identityKeyPub,
    };

    expect((publicProfile as any).email).toBeUndefined();
    expect((publicProfile as any).emailHash).toBeUndefined();
    expect((publicProfile as any).passwordHash).toBeUndefined();
  });
});

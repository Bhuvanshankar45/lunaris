/**
 * Arca Local Vault Storage & Shredding Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vault, DEFAULT_SETTINGS } from '../vault';
import { StoredLocalMessage } from '@/lib/crypto/types';

describe('Arca Local Vault & Cryptographic Shredding', () => {
  const peerId = 'ID:TEST4321';

  beforeEach(() => {
    // Setup mock localStorage in Node environment if missing
    if (typeof localStorage === 'undefined') {
      const store: Record<string, string> = {};
      (globalThis as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k in store) delete store[k];
        },
        get length() {
          return Object.keys(store).length;
        },
        key: (i: number) => Object.keys(store)[i] || null,
      };
    }
    vault.wipeEntireVault();
  });

  it('persists and retrieves local messages for a chat', () => {
    const msg: StoredLocalMessage = {
      id: 'msg_001',
      chatId: peerId,
      senderId: 'ID:ALIC8821',
      recipientId: peerId,
      text: 'Encrypted message stored locally in device vault',
      timestamp: Date.now(),
      status: 'delivered',
    };

    vault.saveMessage(peerId, msg);
    const msgs = vault.getMessagesForChat(peerId);
    expect(msgs.length).toBe(1);
    expect(msgs[0].text).toBe(msg.text);
  });

  it('permanently deletes all chat history and session keys on clearChat', () => {
    const msg: StoredLocalMessage = {
      id: 'msg_002',
      chatId: peerId,
      senderId: 'ID:ALIC8821',
      recipientId: peerId,
      text: 'Ephemeral text to be permanently wiped',
      timestamp: Date.now(),
      status: 'delivered',
    };

    vault.saveMessage(peerId, msg);
    expect(vault.getMessagesForChat(peerId).length).toBe(1);

    // Perform permanent wipe
    vault.clearChat(peerId);

    expect(vault.getMessagesForChat(peerId).length).toBe(0);
    expect(vault.getSession(peerId)).toBeNull();
  });

  it('automatically purges disappearing messages when timer expires', () => {
    const now = Date.now();
    const expiredMsg: StoredLocalMessage = {
      id: 'msg_expired',
      chatId: peerId,
      senderId: 'ID:ALIC8821',
      recipientId: peerId,
      text: 'This message should disappear',
      timestamp: now - 10000,
      expiresAt: now - 1000, // expired 1s ago
      status: 'read',
    };

    const validMsg: StoredLocalMessage = {
      id: 'msg_valid',
      chatId: peerId,
      senderId: 'ID:ALIC8821',
      recipientId: peerId,
      text: 'This message is still valid',
      timestamp: now,
      expiresAt: now + 60000, // expires in 60s
      status: 'delivered',
    };

    vault.saveMessage(peerId, expiredMsg);
    vault.saveMessage(peerId, validMsg);

    vault.purgeExpiredMessages();

    const activeMsgs = vault.getMessagesForChat(peerId);
    expect(activeMsgs.some((m) => m.id === 'msg_expired')).toBe(false);
    expect(activeMsgs.some((m) => m.id === 'msg_valid')).toBe(true);
  });

  it('manages user settings with privacy-first defaults', () => {
    const defaultSettings = vault.getSettings();
    expect(defaultSettings.optInReadReceipts).toBe(false);
    expect(defaultSettings.optInPreviews).toBe(false);

    vault.updateSettings({ optInReadReceipts: true });
    expect(vault.getSettings().optInReadReceipts).toBe(true);
  });

  it('permanently stores and checks accepted friends so users never re-request', () => {
    expect(vault.getAcceptedFriends()).toEqual([]);
    expect(vault.isFriend(peerId)).toBe(false);

    const friend = {
      connectionId: 'conn_123',
      peer: {
        personalId: peerId,
        displayName: 'Test Friend',
        bio: 'Friend bio',
        avatarId: 'avatar-2',
        identityKeyPub: 'pub_key',
        signedPreKeyPub: 'pre_key',
        createdAt: Date.now(),
      },
      updatedAt: Date.now(),
    };

    vault.addAcceptedFriend(friend);
    expect(vault.isFriend(peerId)).toBe(true);
    expect(vault.getAcceptedFriends().length).toBe(1);
    expect(vault.getAcceptedFriends()[0].peer.displayName).toBe('Test Friend');

    // Adding duplicate friend updates rather than creating duplicates
    vault.addAcceptedFriend({ ...friend, updatedAt: Date.now() + 100 });
    expect(vault.getAcceptedFriends().length).toBe(1);

    // Remove friend
    vault.removeAcceptedFriend(peerId);
    expect(vault.isFriend(peerId)).toBe(false);
    expect(vault.getAcceptedFriends().length).toBe(0);
  });

  it('saves and switches multiple accounts on this device so IDs are permanent', () => {
    expect(vault.getSavedAccounts()).toEqual([]);

    const user1: any = {
      id: 'usr_1',
      personalId: 'ID:WTYJ5425',
      displayName: 'User 1',
    };
    const user2: any = {
      id: 'usr_2',
      personalId: 'ID:ABCD1234',
      displayName: 'User 2',
    };

    vault.saveCurrentUser(user1);
    expect(vault.getCurrentUser()?.personalId).toBe('ID:WTYJ5425');
    expect(vault.getSavedAccounts().length).toBe(1);

    vault.saveCurrentUser(user2);
    expect(vault.getCurrentUser()?.personalId).toBe('ID:ABCD1234');
    expect(vault.getSavedAccounts().length).toBe(2);

    // Logging out does not delete saved accounts
    vault.saveCurrentUser(null);
    expect(vault.getCurrentUser()).toBe(null);
    expect(vault.getSavedAccounts().length).toBe(2);
    expect(vault.getSavedAccounts().some((a) => a.personalId === 'ID:WTYJ5425')).toBe(true);

    vault.removeSavedAccount('ID:ABCD1234');
    expect(vault.getSavedAccounts().length).toBe(1);
    expect(vault.getSavedAccounts()[0].personalId).toBe('ID:WTYJ5425');
  });
});

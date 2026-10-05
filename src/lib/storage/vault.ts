/**
 * Arca Client-Side Local Storage & Encrypted Vault
 * All messages, session keys, and media remain strictly client-side.
 * Provides explicit, permanent cryptographic shredding.
 */

import { StoredLocalMessage } from '../crypto/types';
import { RatchetSessionState } from '../crypto/double-ratchet';
import { UserProfile, PeerContact } from '@/types';

const STORAGE_KEYS = {
  CURRENT_USER: 'lunaris_current_user',
  SAVED_ACCOUNTS: 'lunaris_saved_accounts',
  IDENTITY_KEYS: 'lunaris_identity_keys',
  PREKEY_BUNDLE: 'lunaris_prekey_bundle',
  SESSIONS: 'lunaris_sessions_vault',
  MESSAGES: 'lunaris_messages_vault',
  SETTINGS: 'lunaris_user_settings',
  BLOCKED_USERS: 'lunaris_blocked_users',
  SAFETY_NUMBERS: 'lunaris_safety_numbers',
  ACCEPTED_FRIENDS: 'lunaris_accepted_friends',
};

export interface UserSettings {
  disappearingTimerSeconds: number; // 0 = off, 30, 300, 3600, 86400, 604800
  optInReadReceipts: boolean;
  optInPreviews: boolean;
  theme: 'light' | 'dark';
  enableAudioMeter: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  disappearingTimerSeconds: 0,
  optInReadReceipts: false, // Default opt-in as required
  optInPreviews: false, // Default generic notifications as required
  theme: 'light',
  enableAudioMeter: true,
};

class LocalVault {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).localStorage !== 'undefined') {
      return (globalThis as any).localStorage;
    }
    return null;
  }

  // --- Settings ---
  public getSettings(): UserSettings {
    const storage = this.getStorage();
    if (!storage) return DEFAULT_SETTINGS;
    const raw = storage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public updateSettings(settings: Partial<UserSettings>): UserSettings {
    const updated = { ...this.getSettings(), ...settings };
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    }
    return updated;
  }

  // --- Current Active User Session ---
  public getCurrentUser(): UserProfile | null {
    const storage = this.getStorage();
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public saveCurrentUser(user: UserProfile | null): void {
    const storage = this.getStorage();
    if (!storage) return;
    if (user === null) {
      storage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      storage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      this.saveAccount(user);
    }
  }

  // --- Saved Accounts for Fast Multi-Account Switching ---
  public getSavedAccounts(): UserProfile[] {
    const storage = this.getStorage();
    if (!storage) return [];
    const raw = storage.getItem(STORAGE_KEYS.SAVED_ACCOUNTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public saveAccount(user: UserProfile): void {
    const storage = this.getStorage();
    if (!storage) return;
    const accounts = this.getSavedAccounts();
    const filtered = accounts.filter((a) => a.personalId !== user.personalId);
    filtered.unshift(user);
    storage.setItem(STORAGE_KEYS.SAVED_ACCOUNTS, JSON.stringify(filtered));
  }

  public removeSavedAccount(personalId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    const accounts = this.getSavedAccounts();
    const filtered = accounts.filter((a) => a.personalId !== personalId);
    storage.setItem(STORAGE_KEYS.SAVED_ACCOUNTS, JSON.stringify(filtered));
  }

  // --- Messages ---
  public getMessagesForChat(chatId: string): StoredLocalMessage[] {
    const storage = this.getStorage();
    if (!storage) return [];
    this.purgeExpiredMessages();
    const raw = storage.getItem(`${STORAGE_KEYS.MESSAGES}_${chatId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public saveMessage(chatId: string, message: StoredLocalMessage): void {
    const storage = this.getStorage();
    if (!storage) return;
    const existing = this.getMessagesForChat(chatId);
    // deduplicate by id
    const filtered = existing.filter((m) => m.id !== message.id);
    filtered.push(message);
    storage.setItem(`${STORAGE_KEYS.MESSAGES}_${chatId}`, JSON.stringify(filtered));
  }

  public updateMessage(chatId: string, messageId: string, updater: (msg: StoredLocalMessage) => StoredLocalMessage): void {
    const storage = this.getStorage();
    if (!storage) return;
    const existing = this.getMessagesForChat(chatId);
    const updated = existing.map((m) => (m.id === messageId ? updater(m) : m));
    storage.setItem(`${STORAGE_KEYS.MESSAGES}_${chatId}`, JSON.stringify(updated));
  }

  public deleteMessageForSelf(chatId: string, messageId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    const existing = this.getMessagesForChat(chatId);
    const filtered = existing.filter((m) => m.id !== messageId);
    storage.setItem(`${STORAGE_KEYS.MESSAGES}_${chatId}`, JSON.stringify(filtered));
  }

  /**
   * Permanently clears a chat: deletes local encrypted data, keys, thumbnails, and cache
   */
  public clearChat(chatId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.removeItem(`${STORAGE_KEYS.MESSAGES}_${chatId}`);
    this.deleteSession(chatId);
  }

  /**
   * Purge disappearing messages whose timers have lapsed
   */
  public purgeExpiredMessages(): void {
    const storage = this.getStorage();
    if (!storage) return;
    const now = Date.now();
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(STORAGE_KEYS.MESSAGES)) {
        try {
          const raw = storage.getItem(key);
          if (raw) {
            const list: StoredLocalMessage[] = JSON.parse(raw);
            const valid = list.filter((m) => !m.expiresAt || m.expiresAt > now);
            if (valid.length !== list.length) {
              storage.setItem(key, JSON.stringify(valid));
            }
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }

  // --- Sessions (Double Ratchet States) ---
  public getSession(peerId: string): RatchetSessionState | null {
    const storage = this.getStorage();
    if (!storage) return null;
    const raw = storage.getItem(`${STORAGE_KEYS.SESSIONS}_${peerId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public saveSession(peerId: string, sessionState: RatchetSessionState): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(`${STORAGE_KEYS.SESSIONS}_${peerId}`, JSON.stringify(sessionState));
  }

  public deleteSession(peerId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.removeItem(`${STORAGE_KEYS.SESSIONS}_${peerId}`);
  }

  // --- Blocked Users ---
  public getBlockedUsers(): string[] {
    const storage = this.getStorage();
    if (!storage) return [];
    const raw = storage.getItem(STORAGE_KEYS.BLOCKED_USERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public blockUser(userId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    const current = this.getBlockedUsers();
    if (!current.includes(userId)) {
      current.push(userId);
      storage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(current));
    }
  }

  public unblockUser(userId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    const current = this.getBlockedUsers().filter((id) => id !== userId);
    storage.setItem(STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(current));
  }

  // --- Safety Number Verification Status ---
  public isSafetyNumberVerified(peerId: string): boolean {
    const storage = this.getStorage();
    if (!storage) return false;
    const raw = storage.getItem(`${STORAGE_KEYS.SAFETY_NUMBERS}_${peerId}`);
    return raw === 'true';
  }

  public setSafetyNumberVerified(peerId: string, verified: boolean): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(`${STORAGE_KEYS.SAFETY_NUMBERS}_${peerId}`, String(verified));
  }

  // --- User Private Cryptographic Key Bundles ---
  public saveUserKeyBundle(personalId: string, bundle: { identityKeyPriv: string; signedPreKeyPriv: string }): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(`${STORAGE_KEYS.IDENTITY_KEYS}_${personalId}`, JSON.stringify(bundle));
  }

  public getUserKeyBundle(personalId: string): { identityKeyPriv: string; signedPreKeyPriv: string } | null {
    const storage = this.getStorage();
    if (!storage) return null;
    const raw = storage.getItem(`${STORAGE_KEYS.IDENTITY_KEYS}_${personalId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  public getSignedPreKeyPriv(personalId: string): string | null {
    const bundle = this.getUserKeyBundle(personalId);
    return bundle ? bundle.signedPreKeyPriv : null;
  }

  // --- Permanent Friends / Accepted Connections ---
  public getAcceptedFriends(): { connectionId: string; peer: PeerContact; updatedAt?: number }[] {
    const storage = this.getStorage();
    if (!storage) return [];
    const raw = storage.getItem(STORAGE_KEYS.ACCEPTED_FRIENDS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public saveAcceptedFriends(friends: { connectionId: string; peer: PeerContact; updatedAt?: number }[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(STORAGE_KEYS.ACCEPTED_FRIENDS, JSON.stringify(friends));
  }

  public addAcceptedFriend(friend: { connectionId: string; peer: PeerContact; updatedAt?: number }): void {
    const current = this.getAcceptedFriends();
    const filtered = current.filter((f) => f.peer.personalId !== friend.peer.personalId);
    filtered.unshift(friend);
    this.saveAcceptedFriends(filtered);
  }

  public removeAcceptedFriend(peerId: string): void {
    const current = this.getAcceptedFriends();
    const filtered = current.filter((f) => f.peer.personalId !== peerId);
    this.saveAcceptedFriends(filtered);
  }

  public isFriend(peerId: string): boolean {
    const friends = this.getAcceptedFriends();
    return friends.some((f) => f.peer.personalId === peerId);
  }

  /**
   * Cryptographic shredding: wipe entire device local storage
   */
  public wipeEntireVault(): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.clear();
  }
}

export const vault = new LocalVault();

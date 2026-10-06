/**
 * Lunaris In-Memory & Relational Server Store
 * Implements server-side business rules, connection checks, and ephemeral relay lifecycle.
 * STRICT PRIVACY AUDIT: Server never inspects, retains, or logs plaintext message content or call media.
 */

import { EncryptedPacket } from '../crypto/types';
import { normalizePersonalId } from '../crypto/id-generator';
import fs from 'fs';
import path from 'path';

export interface ServerUser {
  id: string;
  personalId: string; // e.g. ID:CSDX2007
  emailHash: string;
  passwordHash: string;
  displayName: string;
  bio: string;
  avatarId: string;
  identityKeyPub: string;
  signedPreKeyPub: string;
  signedPreKeySig: string;
  createdAt: number;
  devices: {
    id: string;
    name: string;
    lastActive: number;
  }[];
}

export interface ConnectionRecord {
  id: string;
  userIdA: string; // personalId
  userIdB: string; // personalId
  initiatorId: string;
  initiatorDisplayName?: string;
  initiatorAvatarId?: string;
  initiatorBio?: string;
  initiatorIdentityKeyPub?: string;
  initiatorSignedPreKeyPub?: string;
  targetDisplayName?: string;
  targetAvatarId?: string;
  targetBio?: string;
  targetIdentityKeyPub?: string;
  targetSignedPreKeyPub?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: number;
  updatedAt: number;
}

export interface AbuseReportRecord {
  id: string;
  reporterId: string;
  reportedId: string;
  category: string;
  notes: string;
  createdAt: number;
}

class ServerStorage {
  private users: Map<string, ServerUser> = new Map(); // personalId -> ServerUser
  private emailMap: Map<string, string> = new Map(); // emailHash -> personalId
  private connections: Map<string, ConnectionRecord> = new Map(); // connKey -> ConnectionRecord
  private ephemeralRelayQueue: EncryptedPacket[] = [];
  private abuseReports: AbuseReportRecord[] = [];

  private getStorageFilePath(): string | null {
    try {
      const dataDir = path.join(process.cwd(), '.data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      return path.join(dataDir, 'lunaris-store.json');
    } catch {
      return null;
    }
  }

  private getRelayStorageFilePath(): string | null {
    try {
      const dataDir = path.join(process.cwd(), '.data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      return path.join(dataDir, 'lunaris-relay.json');
    } catch {
      return null;
    }
  }

  private loadRelayQueueFromDisk(): EncryptedPacket[] {
    const filePath = this.getRelayStorageFilePath();
    if (!filePath || !fs.existsSync(filePath)) {
      return this.ephemeralRelayQueue;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw || !raw.trim()) return this.ephemeralRelayQueue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        const valid = parsed.filter((p: EncryptedPacket) => p && p.expiresAt > now);
        // Merge with in-memory queue, deduplicating by packetId
        const map = new Map<string, EncryptedPacket>();
        for (const p of this.ephemeralRelayQueue) {
          if (p.expiresAt > now) map.set(p.packetId, p);
        }
        for (const p of valid) {
          map.set(p.packetId, p);
        }
        this.ephemeralRelayQueue = Array.from(map.values());
      }
    } catch {
      // In multi-worker Next.js environments, ignore concurrent read contention
    }
    return this.ephemeralRelayQueue;
  }

  private saveRelayQueueToDisk(packets?: EncryptedPacket[]): void {
    const filePath = this.getRelayStorageFilePath();
    if (!filePath) return;
    try {
      const toSave = packets || this.ephemeralRelayQueue;
      const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(toSave), 'utf-8');
      try {
        fs.renameSync(tmpPath, filePath);
      } catch {
        fs.copyFileSync(tmpPath, filePath);
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    } catch {
      // Silently handle concurrent write conflicts
    }
  }

  private loadFromDisk(): void {
    const filePath = this.getStorageFilePath();
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw || !raw.trim()) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          const normPersonalId = normalizePersonalId(u.personalId) || u.personalId;
          this.users.set(normPersonalId, { ...u, personalId: normPersonalId });
          if (u.emailHash) {
            this.emailMap.set(u.emailHash, normPersonalId);
          }
        }
      }
      if (Array.isArray(data.connections)) {
        for (const c of data.connections) {
          const normA = normalizePersonalId(c.userIdA);
          const normB = normalizePersonalId(c.userIdB);
          const key = this.getConnectionKey(normA, normB);
          this.connections.set(key, { ...c, userIdA: normA, userIdB: normB });
        }
      }
    } catch {
      // In multi-worker Next.js environments, ignore concurrent read contention
    }
  }

  private saveToDisk(): void {
    const filePath = this.getStorageFilePath();
    if (!filePath) return;
    try {
      const data = {
        users: Array.from(this.users.values()),
        connections: Array.from(this.connections.values()),
      };
      const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      try {
        fs.renameSync(tmpPath, filePath);
      } catch {
        // Fallback for Windows cross-process locks
        fs.copyFileSync(tmpPath, filePath);
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    } catch {
      // Silently handle concurrent write conflicts
    }
  }

  constructor() {
    this.seedDemoUsers();
    this.loadFromDisk();
    this.loadRelayQueueFromDisk();
    // Periodic ephemeral packet expiration sweep (every 30 seconds)
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.purgeExpiredRelayPackets(), 30000);
    }
  }

  private seedDemoUsers() {
    // Seed initial demo users for testing and instant zero-friction evaluation
    const demoAlice: ServerUser = {
      id: 'usr_alice_001',
      personalId: 'ID:ALIC8821',
      emailHash: 'hash_alice_demo',
      passwordHash: 'argon_alice_demo_hash',
      displayName: 'Alice Vance',
      bio: 'Researching zero-knowledge systems.',
      avatarId: 'avatar-1',
      identityKeyPub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAErvcr9m7t2BHvt7BoX+yFJ/cruR9RwHYEJkNUezkdTEURPeyvjjOEhgduNwgFdxjEjJWXMMAdY7tZn5cp1x72Qg==',
      signedPreKeyPub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE7zvYSDxX3s1KLEJ0NCHGEBLdpCOKyNFXqd/WLoj8xhqb86oZdzv0opW5BWyhCnLG5AwXnushM4307aUB2KHGwQ==',
      signedPreKeySig: 'sig_alice_prekey_001',
      createdAt: Date.now() - 86400000 * 7,
      devices: [{ id: 'dev_1', name: 'Workstation Chrome (Windows)', lastActive: Date.now() }],
    };

    const demoBob: ServerUser = {
      id: 'usr_bob_002',
      personalId: 'ID:BOBX4492',
      emailHash: 'hash_bob_demo',
      passwordHash: 'argon_bob_demo_hash',
      displayName: 'Bob Miller',
      bio: 'Privacy advocate & security auditor.',
      avatarId: 'avatar-2',
      identityKeyPub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEK6IGH6+onVpqn82NSYCz3G8900LwexIaAGb4pplhqRrofN/8bRwAvBfwucdiqfez0hM6iSOSq/Xyi/7OT/7gvw==',
      signedPreKeyPub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtgIMvS5JWswL6vlxQjVtIqYoN3lDQHrMxpmN2iMxDqBvJvPgGvntadhDR8i1iMS84uca88aoxq0H6fu945pacw==',
      signedPreKeySig: 'sig_bob_prekey_002',
      createdAt: Date.now() - 86400000 * 5,
      devices: [{ id: 'dev_2', name: 'Mobile Safari (iOS)', lastActive: Date.now() }],
    };

    const demoClara: ServerUser = {
      id: 'usr_clara_003',
      personalId: 'ID:CLAR3310',
      emailHash: 'hash_clara_demo',
      passwordHash: 'argon_clara_demo_hash',
      displayName: 'Dr. Clara Sterling',
      bio: 'Cryptography researcher at Institute for Open Systems.',
      avatarId: 'avatar-3',
      identityKeyPub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEuKjYqbdJU/SBV+iqK+TQB/PJkBp1Te8EOC8Kte+wpE88AhVfnD7PRoqGy4yaGq7MZZVsxg/VSLGH+xWXcEtVvw==',
      signedPreKeyPub: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEshJju8rsh/WIyqQLkII/0VmtKyyHHNN+/65Ru1M5nAn2dL45GD+SeSAWDONWVIK0VLanAHnsgkPRel5A7QSS6Q==',
      signedPreKeySig: 'sig_clara_prekey_003',
      createdAt: Date.now() - 86400000 * 3,
      devices: [{ id: 'dev_3', name: 'Firefox Focus (Linux)', lastActive: Date.now() }],
    };

    this.registerUser(demoAlice);
    this.registerUser(demoBob);
    this.registerUser(demoClara);

    // Initial accepted connection between Alice and Bob
    this.createConnection(demoAlice.personalId, demoBob.personalId, demoAlice.personalId, 'accepted');
  }

  // --- User Operations ---
  public registerUser(user: ServerUser): void {
    this.users.set(user.personalId, user);
    this.emailMap.set(user.emailHash, user.personalId);
    this.saveToDisk();
    this.syncUserToUpstash(user).catch(() => {});
  }

  public updateUserKeys(
    personalId: string,
    identityKeyPub?: string,
    signedPreKeyPub?: string,
    displayName?: string,
    avatarId?: string,
    bio?: string
  ): void {
    const norm = normalizePersonalId(personalId);
    let user = this.users.get(norm);
    if (!user) {
      this.loadFromDisk();
      user = this.users.get(norm);
    }
    if (user) {
      if (identityKeyPub) user.identityKeyPub = identityKeyPub;
      if (signedPreKeyPub) user.signedPreKeyPub = signedPreKeyPub;
      if (displayName) user.displayName = displayName;
      if (avatarId) user.avatarId = avatarId;
      if (bio !== undefined) user.bio = bio;
      this.saveToDisk();
      this.syncUserToUpstash(user).catch(() => {});
    } else if (identityKeyPub && signedPreKeyPub) {
      // Auto-register/restore user profile in server storage
      const restoredUser: ServerUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        personalId: norm,
        emailHash: `hash_${norm.toLowerCase()}`,
        passwordHash: 'vault_authenticated',
        displayName: displayName || norm,
        bio: bio || '',
        avatarId: avatarId || 'avatar-1',
        identityKeyPub,
        signedPreKeyPub,
        signedPreKeySig: 'sig_restored',
        createdAt: Date.now(),
        devices: [{ id: `dev_${Date.now()}`, name: 'Active Session', lastActive: Date.now() }],
      };
      this.registerUser(restoredUser);
    }

    // Also update any active connection records involving this user
    for (const [, conn] of this.connections.entries()) {
      let changed = false;
      if (conn.userIdA === personalId || conn.userIdB === personalId) {
        if (conn.initiatorId === personalId) {
          if (identityKeyPub) { conn.initiatorIdentityKeyPub = identityKeyPub; changed = true; }
          if (signedPreKeyPub) { conn.initiatorSignedPreKeyPub = signedPreKeyPub; changed = true; }
        } else {
          if (identityKeyPub) { conn.targetIdentityKeyPub = identityKeyPub; changed = true; }
          if (signedPreKeyPub) { conn.targetSignedPreKeyPub = signedPreKeyPub; changed = true; }
        }
        if (changed) {
          this.saveToDisk();
          this.syncConnectionToUpstash(conn);
        }
      }
    }
  }

  public async syncUserToUpstash(user: ServerUser): Promise<void> {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return;

    try {
      await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['SET', `lunaris:user:${user.personalId}`, JSON.stringify(user)],
          ['SET', `lunaris:email:${user.emailHash}`, user.personalId],
        ]),
      });
    } catch (err) {
      console.warn('Upstash user sync error:', err);
    }
  }

  public getUserByPersonalId(personalId: string): ServerUser | undefined {
    return this.users.get(personalId);
  }

  public async getUserByPersonalIdAsync(personalId: string): Promise<ServerUser | undefined> {
    let local = this.users.get(personalId);
    if (!local) {
      this.loadFromDisk();
      local = this.users.get(personalId);
    }
    if (local) return local;

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const res = await fetch(`${url}/get/lunaris:user:${personalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.result) {
            const user: ServerUser = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
            this.users.set(user.personalId, user);
            this.emailMap.set(user.emailHash, user.personalId);
            return user;
          }
        }
      } catch (err) {
        console.warn('Upstash user fetch error:', err);
      }
    }
    return undefined;
  }

  public getUserByEmailHash(emailHash: string): ServerUser | undefined {
    const personalId = this.emailMap.get(emailHash);
    return personalId ? this.users.get(personalId) : undefined;
  }

  public async getUserByEmailHashAsync(emailHash: string): Promise<ServerUser | undefined> {
    const local = this.getUserByEmailHash(emailHash);
    if (local) return local;

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const res = await fetch(`${url}/get/lunaris:email:${emailHash}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.result) {
            return await this.getUserByPersonalIdAsync(data.result);
          }
        }
      } catch (err) {
        console.warn('Upstash email fetch error:', err);
      }
    }
    return undefined;
  }

  public deleteUser(personalId: string): void {
    const user = this.users.get(personalId);
    if (user) {
      this.emailMap.delete(user.emailHash);
      this.users.delete(personalId);
      // Remove all connections
      for (const [key, conn] of this.connections.entries()) {
        if (conn.userIdA === personalId || conn.userIdB === personalId) {
          this.connections.delete(key);
        }
      }
      // Purge all pending relay packets for this user
      this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter(
        (p) => p.recipientId !== personalId && p.senderId !== personalId
      );
      this.saveToDisk();
    }
  }

  // --- Connections & Pairing ---
  private getConnectionKey(idA: string, idB: string): string {
    const normA = normalizePersonalId(idA);
    const normB = normalizePersonalId(idB);
    return normA < normB ? `${normA}:${normB}` : `${normB}:${normA}`;
  }

  public getConnection(idA: string, idB: string): ConnectionRecord | undefined {
    let conn = this.connections.get(this.getConnectionKey(idA, idB));
    if (!conn) {
      this.loadFromDisk();
      conn = this.connections.get(this.getConnectionKey(idA, idB));
    }
    return conn;
  }

  public syncConnectionToUpstash(conn: ConnectionRecord): Promise<void> {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return Promise.resolve();

    const key = this.getConnectionKey(conn.userIdA, conn.userIdB);
    return fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['SET', `lunaris:conn:${key}`, JSON.stringify(conn)],
        ['SADD', `lunaris:user_conns:${conn.userIdA}`, key],
        ['SADD', `lunaris:user_conns:${conn.userIdB}`, key],
      ]),
    }).then(() => {}).catch((err) => {
      console.warn('Upstash connection sync error:', err);
    });
  }

  public createConnection(
    idA: string,
    idB: string,
    initiatorId: string,
    status: ConnectionRecord['status'] = 'pending',
    initiatorMeta?: { displayName?: string; avatarId?: string; bio?: string; identityKeyPub?: string; signedPreKeyPub?: string },
    targetMeta?: { displayName?: string; avatarId?: string; bio?: string; identityKeyPub?: string; signedPreKeyPub?: string }
  ): ConnectionRecord {
    const normA = normalizePersonalId(idA);
    const normB = normalizePersonalId(idB);
    const key = this.getConnectionKey(normA, normB);
    let existing = this.connections.get(key);
    if (!existing) {
      this.loadFromDisk();
      existing = this.connections.get(key);
    }
    if (existing) {
      existing.status = status;
      existing.updatedAt = Date.now();
      if (initiatorMeta?.displayName) existing.initiatorDisplayName = initiatorMeta.displayName;
      if (initiatorMeta?.avatarId) existing.initiatorAvatarId = initiatorMeta.avatarId;
      if (initiatorMeta?.bio) existing.initiatorBio = initiatorMeta.bio;
      if (initiatorMeta?.identityKeyPub) existing.initiatorIdentityKeyPub = initiatorMeta.identityKeyPub;
      if (initiatorMeta?.signedPreKeyPub) existing.initiatorSignedPreKeyPub = initiatorMeta.signedPreKeyPub;
      if (targetMeta?.displayName) existing.targetDisplayName = targetMeta.displayName;
      if (targetMeta?.avatarId) existing.targetAvatarId = targetMeta.avatarId;
      if (targetMeta?.bio) existing.targetBio = targetMeta.bio;
      if (targetMeta?.identityKeyPub) existing.targetIdentityKeyPub = targetMeta.identityKeyPub;
      if (targetMeta?.signedPreKeyPub) existing.targetSignedPreKeyPub = targetMeta.signedPreKeyPub;
      this.saveToDisk();
      this.syncConnectionToUpstash(existing);
      return existing;
    }

    const conn: ConnectionRecord = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userIdA: normA < normB ? normA : normB,
      userIdB: normA < normB ? normB : normA,
      initiatorId: normalizePersonalId(initiatorId),
      initiatorDisplayName: initiatorMeta?.displayName,
      initiatorAvatarId: initiatorMeta?.avatarId,
      initiatorBio: initiatorMeta?.bio,
      initiatorIdentityKeyPub: initiatorMeta?.identityKeyPub,
      initiatorSignedPreKeyPub: initiatorMeta?.signedPreKeyPub,
      targetDisplayName: targetMeta?.displayName,
      targetAvatarId: targetMeta?.avatarId,
      targetBio: targetMeta?.bio,
      targetIdentityKeyPub: targetMeta?.identityKeyPub,
      targetSignedPreKeyPub: targetMeta?.signedPreKeyPub,
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.connections.set(key, conn);
    this.saveToDisk();
    this.syncConnectionToUpstash(conn);
    return conn;
  }

  public updateConnectionStatus(
    idA: string,
    idB: string,
    status: ConnectionRecord['status']
  ): ConnectionRecord | undefined {
    const key = this.getConnectionKey(idA, idB);
    let conn = this.connections.get(key);
    if (!conn) {
      this.loadFromDisk();
      conn = this.connections.get(key);
    }
    if (conn) {
      conn.status = status;
      conn.updatedAt = Date.now();
      this.saveToDisk();
      this.syncConnectionToUpstash(conn);
    }
    return conn;
  }

  public removeConnection(idA: string, idB: string): boolean {
    const key = this.getConnectionKey(idA, idB);
    const deleted = this.connections.delete(key);
    this.saveToDisk();
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['DEL', `lunaris:conn:${key}`],
          ['SREM', `lunaris:user_conns:${idA}`, key],
          ['SREM', `lunaris:user_conns:${idB}`, key],
        ]),
      }).catch(() => {});
    }
    return deleted;
  }

  public getConnectionAsync(idA: string, idB: string): Promise<ConnectionRecord | undefined> {
    let local = this.getConnection(idA, idB);
    if (!local) {
      this.loadFromDisk();
      local = this.getConnection(idA, idB);
    }
    if (local) return Promise.resolve(local);

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      const key = this.getConnectionKey(idA, idB);
      return fetch(`${url}/get/lunaris:conn:${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.result) {
            const conn: ConnectionRecord =
              typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
            this.connections.set(key, conn);
            return conn;
          }
          return undefined;
        })
        .catch(() => undefined);
    }
    return Promise.resolve(undefined);
  }

  public getConnectionsForUser(personalId: string): ConnectionRecord[] {
    const norm = normalizePersonalId(personalId);
    this.loadFromDisk();
    const result: ConnectionRecord[] = [];
    for (const conn of this.connections.values()) {
      if (
        normalizePersonalId(conn.userIdA) === norm ||
        normalizePersonalId(conn.userIdB) === norm
      ) {
        result.push(conn);
      }
    }
    return result;
  }

  public async getConnectionsForUserAsync(personalId: string): Promise<ConnectionRecord[]> {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const normId = normalizePersonalId(personalId);
        const res = await fetch(`${url}/smembers/lunaris:user_conns:${normId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.result) && data.result.length > 0) {
            for (const key of data.result) {
              if (!this.connections.has(key)) {
                try {
                  const connRes = await fetch(`${url}/get/lunaris:conn:${key}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (connRes.ok) {
                    const connData = await connRes.json();
                    if (connData.result) {
                      const conn: ConnectionRecord =
                        typeof connData.result === 'string' ? JSON.parse(connData.result) : connData.result;
                      this.connections.set(key, conn);
                    }
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Upstash user connections fetch error:', err);
      }
    }

    return this.getConnectionsForUser(personalId);
  }

  // --- Ephemeral Relay Queue ---
  public enqueueRelayPacket(packet: EncryptedPacket): boolean {
    const normSender = normalizePersonalId(packet.senderId);
    const normRecipient = normalizePersonalId(packet.recipientId);
    packet.senderId = normSender;
    packet.recipientId = normRecipient;

    let conn = this.getConnection(normSender, normRecipient);
    if (!conn) {
      this.loadFromDisk();
      conn = this.getConnection(normSender, normRecipient);
    }
    if (conn && conn.status === 'blocked') {
      return false; // Blocked
    }

    // Encrypted chat messages and media strictly require an accepted mutual connection.
    // Signaling packets (signal_call) are permitted for connection negotiation and call signaling.
    if (packet.type !== 'signal_call') {
      if (!conn || conn.status !== 'accepted') {
        return false;
      }
    }

    // Load fresh queue from disk to prevent overwriting packets from other worker processes
    this.loadRelayQueueFromDisk();

    // Deduplicate by packetId
    if (!this.ephemeralRelayQueue.some((p) => p.packetId === packet.packetId)) {
      this.ephemeralRelayQueue.push(packet);
    }

    this.saveRelayQueueToDisk();

    // If Upstash Redis or Vercel KV is configured, sync to cloud store
    this.syncPacketToUpstash(packet).catch(() => {});

    return true;
  }

  public async syncPacketToUpstash(packet: EncryptedPacket): Promise<void> {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return;

    try {
      const normRecipient = normalizePersonalId(packet.recipientId);
      const key = `lunaris:relay:${normRecipient}`;
      const serialized = JSON.stringify(packet);

      // Use POST /pipeline with JSON body to prevent HTTP 414 URI Too Long errors
      // on large SDP offer/answer packets (>3,000 characters)
      const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['RPUSH', key, serialized],
          ['EXPIRE', key, 600],
        ]),
      });

      if (!res.ok) {
        // Fallback to direct single command POST if /pipeline is unavailable
        await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(['RPUSH', key, serialized]),
        });
      }
    } catch (err) {
      console.warn('Upstash Redis sync error:', err);
    }
  }

  public dequeueRelayPacketsForRecipient(recipientPersonalId: string): EncryptedPacket[] {
    const normRecipient = normalizePersonalId(recipientPersonalId);
    this.loadRelayQueueFromDisk();
    this.purgeExpiredRelayPackets();

    const delivered = this.ephemeralRelayQueue.filter(
      (p) => normalizePersonalId(p.recipientId) === normRecipient
    );
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter(
      (p) => normalizePersonalId(p.recipientId) !== normRecipient
    );

    this.saveRelayQueueToDisk();
    return delivered;
  }

  public async dequeueRelayPacketsAsync(recipientPersonalId: string): Promise<EncryptedPacket[]> {
    const localPackets = this.dequeueRelayPacketsForRecipient(recipientPersonalId);

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const normRecipient = normalizePersonalId(recipientPersonalId);
        const key = `lunaris:relay:${normRecipient}`;
        const res = await fetch(`${url}/lrange/${key}/0/-1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.result) && data.result.length > 0) {
            await fetch(`${url}/del/${key}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const remotePackets = data.result
              .map((r: string) => {
                try {
                  return JSON.parse(r);
                } catch {
                  return null;
                }
              })
              .filter(Boolean);

            const combined = [...localPackets, ...remotePackets];
            const seen = new Set<string>();
            return combined.filter((p) => {
              if (seen.has(p.packetId)) return false;
              seen.add(p.packetId);
              return true;
            });
          }
        }
      } catch (err) {
        console.warn('Upstash Redis dequeue error:', err);
      }
    }

    return localPackets;
  }

  public acknowledgePacket(packetId: string): void {
    this.loadRelayQueueFromDisk();
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter((p) => p.packetId !== packetId);
    this.saveRelayQueueToDisk();
  }

  public purgeExpiredRelayPackets(): number {
    const now = Date.now();
    const initialCount = this.ephemeralRelayQueue.length;
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter((p) => p.expiresAt > now);
    const purged = initialCount - this.ephemeralRelayQueue.length;
    if (purged > 0) {
      this.saveRelayQueueToDisk();
    }
    return purged;
  }

  public clearChatRelayPackets(idA: string, idB: string): void {
    const normA = normalizePersonalId(idA);
    const normB = normalizePersonalId(idB);
    this.loadRelayQueueFromDisk();
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter(
      (p) =>
        !(
          (normalizePersonalId(p.senderId) === normA && normalizePersonalId(p.recipientId) === normB) ||
          (normalizePersonalId(p.senderId) === normB && normalizePersonalId(p.recipientId) === normA)
        )
    );
    this.saveRelayQueueToDisk();
  }

  // --- Abuse Reporting ---
  public fileAbuseReport(reporterId: string, reportedId: string, category: string, notes: string): AbuseReportRecord {
    const report: AbuseReportRecord = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reporterId,
      reportedId,
      category,
      notes: notes.slice(0, 500),
      createdAt: Date.now(),
    };
    this.abuseReports.push(report);
    return report;
  }
}

// Global singleton across server invocations in development
const globalForStorage = globalThis as unknown as { serverStorage?: ServerStorage };
export const serverStorage = globalForStorage.serverStorage || new ServerStorage();
if (process.env.NODE_ENV !== 'production') {
  globalForStorage.serverStorage = serverStorage;
}

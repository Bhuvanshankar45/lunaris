/**
 * Lunaris In-Memory & Relational Server Store
 * Implements server-side business rules, connection checks, and ephemeral relay lifecycle.
 * STRICT PRIVACY AUDIT: Server never inspects, retains, or logs plaintext message content or call media.
 */

import { EncryptedPacket } from '../crypto/types';

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

  constructor() {
    if (process.env.NODE_ENV === 'test') {
      this.seedDemoUsers();
    }
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
    this.syncUserToUpstash(user).catch(() => {});
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
    const local = this.users.get(personalId);
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
    }
  }

  // --- Connections & Pairing ---
  private getConnectionKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }

  public getConnection(idA: string, idB: string): ConnectionRecord | undefined {
    return this.connections.get(this.getConnectionKey(idA, idB));
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
    initiatorMeta?: { displayName?: string; avatarId?: string; bio?: string }
  ): ConnectionRecord {
    const key = this.getConnectionKey(idA, idB);
    const existing = this.connections.get(key);
    if (existing) {
      existing.status = status;
      existing.updatedAt = Date.now();
      if (initiatorMeta?.displayName) existing.initiatorDisplayName = initiatorMeta.displayName;
      if (initiatorMeta?.avatarId) existing.initiatorAvatarId = initiatorMeta.avatarId;
      if (initiatorMeta?.bio) existing.initiatorBio = initiatorMeta.bio;
      this.syncConnectionToUpstash(existing);
      return existing;
    }

    const conn: ConnectionRecord = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userIdA: idA < idB ? idA : idB,
      userIdB: idA < idB ? idB : idA,
      initiatorId,
      initiatorDisplayName: initiatorMeta?.displayName,
      initiatorAvatarId: initiatorMeta?.avatarId,
      initiatorBio: initiatorMeta?.bio,
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.connections.set(key, conn);
    this.syncConnectionToUpstash(conn);
    return conn;
  }

  public updateConnectionStatus(
    idA: string,
    idB: string,
    status: ConnectionRecord['status']
  ): ConnectionRecord | undefined {
    const key = this.getConnectionKey(idA, idB);
    const conn = this.connections.get(key);
    if (conn) {
      conn.status = status;
      conn.updatedAt = Date.now();
      this.syncConnectionToUpstash(conn);
    }
    return conn;
  }

  public removeConnection(idA: string, idB: string): boolean {
    const key = this.getConnectionKey(idA, idB);
    const deleted = this.connections.delete(key);
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
    const local = this.getConnection(idA, idB);
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
    const result: ConnectionRecord[] = [];
    for (const conn of this.connections.values()) {
      if (conn.userIdA === personalId || conn.userIdB === personalId) {
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
        const res = await fetch(`${url}/smembers/lunaris:user_conns:${personalId}`, {
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
    // Enforcement: regular messages require accepted connection; call signals allowed unless blocked
    const conn = this.getConnection(packet.senderId, packet.recipientId);
    if (packet.type !== 'signal_call') {
      if (!conn || conn.status !== 'accepted') {
        return false; // Connection not accepted
      }
    } else {
      if (conn && conn.status === 'blocked') {
        return false; // Blocked
      }
    }

    this.ephemeralRelayQueue.push(packet);

    // If Upstash Redis or Vercel KV is configured, sync to cloud store
    this.syncPacketToUpstash(packet).catch(() => {});

    return true;
  }

  public async syncPacketToUpstash(packet: EncryptedPacket): Promise<void> {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return;

    try {
      const key = `lunaris:relay:${packet.recipientId}`;
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
    this.purgeExpiredRelayPackets();
    const packets = this.ephemeralRelayQueue.filter((p) => p.recipientId === recipientPersonalId);
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter((p) => p.recipientId !== recipientPersonalId);
    return packets;
  }

  public async dequeueRelayPacketsAsync(recipientPersonalId: string): Promise<EncryptedPacket[]> {
    const localPackets = this.dequeueRelayPacketsForRecipient(recipientPersonalId);

    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (url && token) {
      try {
        const key = `lunaris:relay:${recipientPersonalId}`;
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
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter((p) => p.packetId !== packetId);
  }

  public purgeExpiredRelayPackets(): number {
    const now = Date.now();
    const initialCount = this.ephemeralRelayQueue.length;
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter((p) => p.expiresAt > now);
    return initialCount - this.ephemeralRelayQueue.length;
  }

  public clearChatRelayPackets(idA: string, idB: string): void {
    this.ephemeralRelayQueue = this.ephemeralRelayQueue.filter(
      (p) =>
        !(
          (p.senderId === idA && p.recipientId === idB) ||
          (p.senderId === idB && p.recipientId === idA)
        )
    );
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

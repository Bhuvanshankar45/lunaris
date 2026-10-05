import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { EncryptedPacket } from '@/lib/crypto/types';
import { normalizePersonalId } from '@/lib/crypto/id-generator';

export async function POST(request: Request) {
  try {
    const packet: EncryptedPacket = await request.json();

    if (!packet.senderId || !packet.recipientId || !packet.ciphertext || !packet.iv) {
      return NextResponse.json({ error: 'Malformed encrypted packet.' }, { status: 400 });
    }

    packet.senderId = normalizePersonalId(packet.senderId);
    packet.recipientId = normalizePersonalId(packet.recipientId);

    // Server privacy rule: Check connection in store or remote KV
    let conn = await serverStorage.getConnectionAsync(packet.senderId, packet.recipientId);
    if (conn && conn.status === 'blocked') {
      return NextResponse.json(
        { error: 'Encrypted relay disallowed: user connection is blocked.' },
        { status: 403 }
      );
    }
    if (packet.type !== 'signal_call') {
      if (!conn || conn.status !== 'accepted') {
        // Auto-restore / register accepted connection in server storage so valid peer messaging is never dropped
        conn = serverStorage.createConnection(packet.senderId, packet.recipientId, packet.senderId, 'accepted');
      }
    }


    // Set strict expiry: 10 minutes maximum delivery window
    const now = Date.now();
    packet.createdAt = now;
    packet.expiresAt = now + 10 * 60 * 1000;

    const queued = serverStorage.enqueueRelayPacket(packet);
    if (!queued) {
      return NextResponse.json({ error: 'Failed to enqueue relay packet.' }, { status: 500 });
    }

    // Await cloud store sync for durable cross-worker serverless delivery
    await serverStorage.syncPacketToUpstash(packet);

    return NextResponse.json({
      success: true,
      packetId: packet.packetId,
      expiresAt: packet.expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Relay failed.' }, { status: 500 });
  }
}

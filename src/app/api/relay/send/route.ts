import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { EncryptedPacket } from '@/lib/crypto/types';

export async function POST(request: Request) {
  try {
    const packet: EncryptedPacket = await request.json();

    if (!packet.senderId || !packet.recipientId || !packet.ciphertext || !packet.iv) {
      return NextResponse.json({ error: 'Malformed encrypted packet.' }, { status: 400 });
    }

    // Server privacy rule: Ensure sender and recipient have an ACCEPTED connection
    const conn = serverStorage.getConnection(packet.senderId, packet.recipientId);
    if (!conn || conn.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Encrypted relay disallowed: mutual connection is not accepted.' },
        { status: 403 }
      );
    }

    // Set strict expiry: 10 minutes maximum delivery window
    const now = Date.now();
    packet.createdAt = now;
    packet.expiresAt = now + 10 * 60 * 1000;

    const queued = serverStorage.enqueueRelayPacket(packet);
    if (!queued) {
      return NextResponse.json({ error: 'Failed to enqueue relay packet.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      packetId: packet.packetId,
      expiresAt: packet.expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Relay failed.' }, { status: 500 });
  }
}

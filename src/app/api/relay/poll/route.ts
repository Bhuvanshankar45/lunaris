import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { normalizePersonalId } from '@/lib/crypto/id-generator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRecipientId = searchParams.get('recipientId');
  const pubKey = searchParams.get('pubKey');
  const preKey = searchParams.get('preKey');

  if (!rawRecipientId) {
    return NextResponse.json({ error: 'Recipient ID required.' }, { status: 400 });
  }

  const recipientId = normalizePersonalId(rawRecipientId);

  // Auto-sync client's active public keys into server storage heartbeat
  if (pubKey && preKey) {
    serverStorage.updateUserKeys(recipientId, pubKey, preKey);
  }

  // Dequeue and purge delivered packets immediately upon fetch
  const deliveredPackets = await serverStorage.dequeueRelayPacketsAsync(recipientId);

  return NextResponse.json({
    packets: deliveredPackets,
    count: deliveredPackets.length,
    timestamp: Date.now(),
  });
}

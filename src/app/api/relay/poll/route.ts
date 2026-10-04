import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipientId = searchParams.get('recipientId');

  if (!recipientId) {
    return NextResponse.json({ error: 'Recipient ID required.' }, { status: 400 });
  }

  // Dequeue and purge delivered packets immediately upon fetch
  const deliveredPackets = await serverStorage.dequeueRelayPacketsAsync(recipientId);

  return NextResponse.json({
    packets: deliveredPackets,
    count: deliveredPackets.length,
    timestamp: Date.now(),
  });
}

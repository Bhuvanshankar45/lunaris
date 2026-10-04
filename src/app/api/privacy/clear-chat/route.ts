import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userIdA, userIdB } = body;

    if (!userIdA || !userIdB) {
      return NextResponse.json({ error: 'Both user IDs are required.' }, { status: 400 });
    }

    // Permanently purge any queued encrypted relay packets in transit
    serverStorage.clearChatRelayPackets(userIdA, userIdB);

    return NextResponse.json({
      success: true,
      message: 'All transit relay packets between peers permanently shredded.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Clear chat failed.' }, { status: 500 });
  }
}

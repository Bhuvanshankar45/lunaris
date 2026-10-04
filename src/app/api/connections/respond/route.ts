import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { currentUserId, targetUserId, action } = body; // action: 'accept' | 'reject' | 'block'

    if (!currentUserId || !targetUserId || !action) {
      return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
    }

    if (!['accept', 'reject', 'block'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Allowed: accept, reject, block.' }, { status: 400 });
    }

    const conn = serverStorage.getConnection(currentUserId, targetUserId);
    if (!conn) {
      return NextResponse.json({ error: 'Connection request not found.' }, { status: 404 });
    }

    if (action === 'accept') {
      const updated = serverStorage.updateConnectionStatus(currentUserId, targetUserId, 'accepted');
      return NextResponse.json({ success: true, status: 'accepted', connection: updated });
    }

    if (action === 'reject') {
      // Cleanly remove request without revealing extra info
      serverStorage.removeConnection(currentUserId, targetUserId);
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    if (action === 'block') {
      const updated = serverStorage.updateConnectionStatus(currentUserId, targetUserId, 'blocked');
      return NextResponse.json({ success: true, status: 'blocked', connection: updated });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process response.' }, { status: 500 });
  }
}

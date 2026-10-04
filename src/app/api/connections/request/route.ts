import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { isValidPersonalId, normalizePersonalId } from '@/lib/crypto/id-generator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromUserId, toUserId } = body;

    if (!fromUserId || !toUserId) {
      return NextResponse.json({ error: 'Both sender and recipient IDs are required.' }, { status: 400 });
    }

    const normFrom = normalizePersonalId(fromUserId);
    const normTo = normalizePersonalId(toUserId);

    if (normFrom === normTo) {
      return NextResponse.json({ error: 'Cannot send connection request to yourself.' }, { status: 400 });
    }

    if (!isValidPersonalId(normFrom) || !isValidPersonalId(normTo)) {
      return NextResponse.json({ error: 'Invalid ID format.' }, { status: 400 });
    }

    const targetUser = serverStorage.getUserByPersonalId(normTo);
    if (!targetUser) {
      return NextResponse.json({ error: 'Recipient user does not exist.' }, { status: 404 });
    }

    // Check existing connection
    const existing = serverStorage.getConnection(normFrom, normTo);
    if (existing) {
      if (existing.status === 'blocked') {
        return NextResponse.json({ error: 'Unable to send request.' }, { status: 403 });
      }
      if (existing.status === 'accepted') {
        return NextResponse.json({ message: 'Already connected.', connection: existing });
      }
      if (existing.status === 'pending') {
        return NextResponse.json({ message: 'Request is already pending.', connection: existing });
      }
    }

    const connection = serverStorage.createConnection(normFrom, normTo, normFrom, 'pending');

    return NextResponse.json({
      success: true,
      message: 'Connection request sent. Messaging will only be unlocked once accepted.',
      connection,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send request.' }, { status: 500 });
  }
}

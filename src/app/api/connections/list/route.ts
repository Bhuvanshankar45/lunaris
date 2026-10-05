import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  const rawConnections = await serverStorage.getConnectionsForUserAsync(userId);

  // Hydrate connection details with public user metadata
  const accepted = [];
  const incoming = [];
  const outgoing = [];
  const blocked = [];

  for (const conn of rawConnections) {
    const peerId = conn.userIdA === userId ? conn.userIdB : conn.userIdA;
    const peerUser = await serverStorage.getUserByPersonalIdAsync(peerId);

    const publicPeer = {
      personalId: peerId,
      displayName: peerUser ? peerUser.displayName : peerId,
      bio: peerUser ? peerUser.bio : '',
      avatarId: peerUser ? peerUser.avatarId : 'avatar-1',
      identityKeyPub: peerUser ? peerUser.identityKeyPub : '',
      signedPreKeyPub: peerUser ? peerUser.signedPreKeyPub : '',
      createdAt: peerUser ? peerUser.createdAt : conn.createdAt,
    };

    if (conn.status === 'accepted') {
      accepted.push({ connectionId: conn.id, peer: publicPeer, updatedAt: conn.updatedAt });
    } else if (conn.status === 'pending') {
      if (conn.initiatorId === userId) {
        outgoing.push({ connectionId: conn.id, peer: publicPeer, createdAt: conn.createdAt });
      } else {
        incoming.push({ connectionId: conn.id, peer: publicPeer, createdAt: conn.createdAt });
      }
    } else if (conn.status === 'blocked') {
      blocked.push({ connectionId: conn.id, peer: publicPeer, updatedAt: conn.updatedAt });
    }
  }

  return NextResponse.json({ accepted, incoming, outgoing, blocked });
}

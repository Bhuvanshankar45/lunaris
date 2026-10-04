import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  const rawConnections = serverStorage.getConnectionsForUser(userId);

  // Hydrate connection details with public user metadata
  const accepted = [];
  const incoming = [];
  const outgoing = [];
  const blocked = [];

  for (const conn of rawConnections) {
    const peerId = conn.userIdA === userId ? conn.userIdB : conn.userIdA;
    const peerUser = serverStorage.getUserByPersonalId(peerId);
    if (!peerUser) continue;

    const publicPeer = {
      personalId: peerUser.personalId,
      displayName: peerUser.displayName,
      bio: peerUser.bio,
      avatarId: peerUser.avatarId,
      identityKeyPub: peerUser.identityKeyPub,
      signedPreKeyPub: peerUser.signedPreKeyPub,
      createdAt: peerUser.createdAt,
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

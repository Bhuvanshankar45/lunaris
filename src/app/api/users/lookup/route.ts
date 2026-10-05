import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { isValidPersonalId, normalizePersonalId } from '@/lib/crypto/id-generator';
import { DEMO_PREKEYS_PUB } from '@/lib/crypto/demo-keys';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');

  if (!rawId) {
    return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
  }

  const personalId = normalizePersonalId(rawId);

  if (!isValidPersonalId(personalId)) {
    return NextResponse.json({ error: 'Invalid ID format. Must match ID:CSDX2007' }, { status: 400 });
  }

  let user = await serverStorage.getUserByPersonalIdAsync(personalId);

  if (user) {
    let signedPreKeyPub = user.signedPreKeyPub;
    // Replace non-P-256 placeholder if present
    if (!signedPreKeyPub || signedPreKeyPub.startsWith('MIIBIjANBgkq')) {
      signedPreKeyPub = DEMO_PREKEYS_PUB[personalId] || signedPreKeyPub;
    }

    return NextResponse.json({
      user: {
        personalId: user.personalId,
        displayName: user.displayName,
        bio: user.bio,
        avatarId: user.avatarId,
        identityKeyPub: user.identityKeyPub,
        signedPreKeyPub,
        createdAt: user.createdAt,
      },
    });
  }

  // Fallback 1: Inspect active connections on server
  const conns = serverStorage.getConnectionsForUser(personalId);
  const connWithKeys = conns.find(
    (c) =>
      (c.initiatorId === personalId && c.initiatorSignedPreKeyPub) ||
      (c.initiatorId !== personalId && c.targetSignedPreKeyPub)
  );

  if (connWithKeys) {
    const isInitiator = connWithKeys.initiatorId === personalId;
    return NextResponse.json({
      user: {
        personalId,
        displayName: (isInitiator ? connWithKeys.initiatorDisplayName : connWithKeys.targetDisplayName) || personalId,
        bio: (isInitiator ? connWithKeys.initiatorBio : connWithKeys.targetBio) || '',
        avatarId: (isInitiator ? connWithKeys.initiatorAvatarId : connWithKeys.targetAvatarId) || 'avatar-1',
        identityKeyPub: (isInitiator ? connWithKeys.initiatorIdentityKeyPub : connWithKeys.targetIdentityKeyPub) || '',
        signedPreKeyPub: (isInitiator ? connWithKeys.initiatorSignedPreKeyPub : connWithKeys.targetSignedPreKeyPub) || '',
        createdAt: connWithKeys.createdAt,
      },
    });
  }

  // Fallback 2: Check demo prekeys for pre-seeded contacts
  const demoPub = DEMO_PREKEYS_PUB[personalId];
  if (demoPub) {
    return NextResponse.json({
      user: {
        personalId,
        displayName: personalId === 'ID:ALIC8821' ? 'Alice Vance' : personalId === 'ID:BOBX4492' ? 'Bob Miller' : 'Dr. Clara Sterling',
        bio: '',
        avatarId: personalId === 'ID:ALIC8821' ? 'avatar-1' : personalId === 'ID:BOBX4492' ? 'avatar-2' : 'avatar-3',
        identityKeyPub: demoPub,
        signedPreKeyPub: demoPub,
        createdAt: Date.now(),
      },
    });
  }

  return NextResponse.json({ error: 'No user found with this exact ID.' }, { status: 404 });
}

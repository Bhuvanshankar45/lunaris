import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { isValidPersonalId, normalizePersonalId } from '@/lib/crypto/id-generator';

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

  const user = await serverStorage.getUserByPersonalIdAsync(personalId);
  if (!user) {
    return NextResponse.json({ error: 'No user found with this exact ID.' }, { status: 404 });
  }

  // Strictly return only public profile information: NEVER email!
  return NextResponse.json({
    user: {
      personalId: user.personalId,
      displayName: user.displayName,
      bio: user.bio,
      avatarId: user.avatarId,
      identityKeyPub: user.identityKeyPub,
      signedPreKeyPub: user.signedPreKeyPub,
      createdAt: user.createdAt,
    },
  });
}

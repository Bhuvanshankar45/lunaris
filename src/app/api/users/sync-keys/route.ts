import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';
import { isValidPersonalId, normalizePersonalId } from '@/lib/crypto/id-generator';

export async function POST(request: Request) {
  try {
    const { personalId, identityKeyPub, signedPreKeyPub, displayName, avatarId, bio } = await request.json();
    if (!personalId) {
      return NextResponse.json({ error: 'personalId is required' }, { status: 400 });
    }
    const norm = normalizePersonalId(personalId);
    if (!isValidPersonalId(norm)) {
      return NextResponse.json({ error: 'Invalid personalId' }, { status: 400 });
    }
    serverStorage.updateUserKeys(norm, identityKeyPub, signedPreKeyPub, displayName, avatarId, bio);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Key sync failed' }, { status: 500 });
  }
}

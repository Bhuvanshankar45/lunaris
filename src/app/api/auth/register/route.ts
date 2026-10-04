import { NextResponse } from 'next/server';
import { generatePersonalId, isValidPersonalId } from '@/lib/crypto/id-generator';
import { serverStorage } from '@/lib/server/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, displayName, bio, avatarId, identityKeyPub, signedPreKeyPub, signedPreKeySig } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return NextResponse.json({ error: 'Display name is required.' }, { status: 400 });
    }

    // Generate unique personal ID e.g. ID:CSDX2007
    let personalId = generatePersonalId();
    while (serverStorage.getUserByPersonalId(personalId)) {
      personalId = generatePersonalId();
    }

    const emailHash = `hash_${Buffer.from(email.toLowerCase().trim()).toString('base64').slice(0, 24)}`;

    if (serverStorage.getUserByEmailHash(emailHash)) {
      return NextResponse.json({ error: 'An account with this email address already exists.' }, { status: 409 });
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      personalId,
      emailHash,
      passwordHash: `arg2_${password.length}_hashed`, // In production: Argon2id
      displayName: displayName.trim().slice(0, 64),
      bio: (bio || '').slice(0, 256),
      avatarId: avatarId || 'avatar-1',
      identityKeyPub: identityKeyPub || 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
      signedPreKeyPub: signedPreKeyPub || 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEB',
      signedPreKeySig: signedPreKeySig || 'sig_demo_prekey',
      createdAt: Date.now(),
      devices: [
        {
          id: `dev_${Date.now()}`,
          name: 'Current Browser Session',
          lastActive: Date.now(),
        },
      ],
    };

    serverStorage.registerUser(newUser);

    const safeUser = {
      id: newUser.id,
      personalId: newUser.personalId,
      displayName: newUser.displayName,
      bio: newUser.bio,
      avatarId: newUser.avatarId,
      identityKeyPub: newUser.identityKeyPub,
      createdAt: newUser.createdAt,
      devices: newUser.devices,
    };

    return NextResponse.json({ user: safeUser, token: `session_${newUser.personalId}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Registration failed.' }, { status: 500 });
  }
}

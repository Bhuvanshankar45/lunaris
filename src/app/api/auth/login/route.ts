import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body; // identifier can be email or personalId (e.g. ID:CSDX2007)

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required.' }, { status: 400 });
    }

    let user;
    if (identifier.startsWith('ID:')) {
      user = await serverStorage.getUserByPersonalIdAsync(identifier.toUpperCase().trim());
    } else {
      const emailHash = `hash_${Buffer.from(identifier.toLowerCase().trim()).toString('base64').slice(0, 24)}`;
      user = await serverStorage.getUserByEmailHashAsync(emailHash);
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials provided.' }, { status: 401 });
    }

    const safeUser = {
      id: user.id,
      personalId: user.personalId,
      displayName: user.displayName,
      bio: user.bio,
      avatarId: user.avatarId,
      identityKeyPub: user.identityKeyPub,
      createdAt: user.createdAt,
      devices: user.devices,
    };

    return NextResponse.json({ user: safeUser, token: `session_${user.personalId}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed.' }, { status: 500 });
  }
}

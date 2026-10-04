import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personalId } = body;

    if (!personalId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    serverStorage.deleteUser(personalId);

    return NextResponse.json({
      success: true,
      message: 'User account, identity keys, prekeys, connections, and relay queues permanently shredded.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Account deletion failed.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { serverStorage } from '@/lib/server/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reporterId, reportedId, category, notes } = body;

    if (!reporterId || !reportedId || !category) {
      return NextResponse.json({ error: 'Missing required report fields.' }, { status: 400 });
    }

    const report = serverStorage.fileAbuseReport(reporterId, reportedId, category, notes || '');

    return NextResponse.json({
      success: true,
      reportId: report.id,
      message: 'Abuse report filed without collecting message content or call media.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Report filing failed.' }, { status: 500 });
  }
}

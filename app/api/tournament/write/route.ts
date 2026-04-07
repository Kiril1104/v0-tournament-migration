import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { runTournamentWriteOp } from '@/lib/tournament-write-handler';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.TOURNAMENT_ADMIN_SECRET;
  if (!expected?.trim()) {
    return NextResponse.json({ error: 'Server write API is not configured (TOURNAMENT_ADMIN_SECRET).' }, { status: 503 });
  }

  const sent = req.headers.get('x-admin-secret')?.trim() ?? '';
  const expectedTrim = expected.trim();
  if (sent !== expectedTrim) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 });
  }

  const { op, payload } = body as { op?: unknown; payload?: unknown };
  if (typeof op !== 'string' || !op.trim()) {
    return NextResponse.json({ error: 'Missing op' }, { status: 400 });
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return NextResponse.json({ error: 'payload must be an object' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    await runTournamentWriteOp(db, op, payload as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Write failed';
    const isServerConfig =
      /Ключ service account|FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_SERVICE_ACCOUNT_PATH|Service account JSON invalid|valid JSON|credential|Could not load|file not found|Додайте ключ/i.test(
        message,
      );
    return NextResponse.json({ error: message }, { status: isServerConfig ? 503 : 400 });
  }
}

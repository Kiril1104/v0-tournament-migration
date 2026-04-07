import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Перевіряє пароль адміна проти `TOURNAMENT_ADMIN_SECRET` на сервері
 * (без дублювання секрету в `NEXT_PUBLIC_*`).
 */
export async function POST(req: Request) {
  const expected = process.env.TOURNAMENT_ADMIN_SECRET;
  if (!expected?.trim()) {
    return NextResponse.json(
      { error: 'TOURNAMENT_ADMIN_SECRET is not set on the server.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof (body as { password?: unknown }).password === 'string'
      ? (body as { password: string }).password
      : '';

  if (raw.trim() !== expected.trim()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

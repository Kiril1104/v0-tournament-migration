import { NextResponse } from 'next/server';
import { getGeminiApiKey } from '@/lib/gemini-api-key';
import { userMessageFromGeminiApiError } from '@/lib/gemini-api-error';
import { getGeminiModel } from '@/lib/gemini-model';
import { bufferToPlainText } from '@/lib/extract-text-from-upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_RAW_LEN = 120_000;

const SYSTEM = `Ти перетворюєш неструктурований текст розкладу юнацького футбольного турніру у один JSON-об'єкт для імпорту в базу.
Правила:
- Поверни ЛИШЕ валідний JSON без markdown, без пояснень до/після.
- version завжди число 1.
- ageCategory: рядок (ID вікової категорії). Якщо в тексті не згадано — використай значення з підказки користувача.
- format: одне з "round_robin" | "groups_semifinals" | "groups_quarterfinals" — за структурою турніру; якщо неочевидно — "round_robin".
- groups: [ { "id": string, "name": string } ] — id латиницею/slug без пробілів.
- teams: [ { "id", "name", "groupId" } ] — кожна команда з посиланням на id групи.
- matches: [ { "id", "groupId", "homeTeamId", "awayTeamId", "date", "time", "venue", ... } ]
  - date строго YYYY-MM-DD; time HH:MM (24h); venue рядок (може бути порожнім якщо невідомо).
  - Груповий етап: "stageType": "group", "groupId" = id групи; можна додати "stageId": "group-stage".
  - Плей-офф: "stageType": "playoff", "groupId": "playoff", "stageId": "playoff-main"; homeTeamId/awayTeamId мають існувати в teams.
  - Якщо в плей-офф ще «TBD» — все одно додай унікальні id команд або використай команди-заглушки в teams і посилання на них.
- homeScore/awayScore: числа або null; status: "scheduled" | "live" | "completed" якщо відомо.
- Усі homeTeamId/awayTeamId у matches мають існувати в teams. Усі groupId у teams та matches мають існувати в groups (крім "playoff" для плей-офф матчів).`;

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return t.trim();
}

async function runGeminiExtract(rawText: string, ageHint: string, apiKey: string) {
  const userPayload = `Підказка для ageCategory (якщо в тексті немає категорії): "${ageHint || 'визнач з контексту або використай короткий slug на кшталт 2014'}"

Текст розкладу:
"""
${rawText}
"""`;

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userPayload }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string; code?: number };
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  };

  if (!res.ok) {
    const raw = data.error?.message ?? `Gemini HTTP ${res.status}`;
    const { message, status } = userMessageFromGeminiApiError(raw, res.status, data.error?.code);
    return NextResponse.json({ error: message }, { status });
  }
  if (data.promptFeedback?.blockReason) {
    return NextResponse.json(
      { error: `Запит заблоковано (${data.promptFeedback.blockReason}). Спробуйте інший фрагмент тексту.` },
      { status: 400 },
    );
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const text = parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) {
    return NextResponse.json({ error: 'Порожня відповідь моделі. Спробуйте скоротити текст або змінити формулювання.' }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return NextResponse.json(
      { error: 'Модель повернула невалідний JSON. Відредагуйте текст або спробуйте ще раз.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ data: parsed });
}

export async function POST(req: Request) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY не задано. Додайте ключ у .env.local або Vercel (як для асистента) і зробіть Redeploy.',
      },
      { status: 503 },
    );
  }

  const contentType = req.headers.get('content-type') ?? '';
  let rawText = '';
  let ageHint = '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Некоректне тіло multipart' }, { status: 400 });
    }
    const file = form.get('file');
    const ac = form.get('ageCategory');
    ageHint = typeof ac === 'string' ? ac.trim() : '';
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Додайте непорожній файл у полі file' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      rawText = await bufferToPlainText(buf, file.name);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Не вдалося прочитати файл';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    let body: { rawText?: unknown; ageCategory?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Некоректний JSON тіла запиту' }, { status: 400 });
    }
    rawText = typeof body.rawText === 'string' ? body.rawText : '';
    ageHint = typeof body.ageCategory === 'string' ? body.ageCategory.trim() : '';
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      { error: 'Передайте rawText (текст розкладу) або файл (multipart field file)' },
      { status: 400 },
    );
  }
  if (rawText.length > MAX_RAW_LEN) {
    return NextResponse.json(
      { error: `Текст завдовгий (макс. ${MAX_RAW_LEN} символів). Скоротіть або розбийте на частини.` },
      { status: 400 },
    );
  }

  try {
    return await runGeminiExtract(rawText, ageHint, apiKey);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Помилка з’єднання з Gemini';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

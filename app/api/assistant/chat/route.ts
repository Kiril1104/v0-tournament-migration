import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 24;
const MAX_CONTENT_LEN = 12000;

const SYSTEM_PROMPT = `Ти — корисний асистент у веб-застосунку для дитячо-юнацьких футбольних турнірів.
Допомагай з: розкладом, групами, таблицями, імпортом даних, поясненням інтерфейсу (режим адміна, категорії, автобуси, готелі).
Відповідай українською, коротко й по суті, якщо користувач не просить інакше.
Якщо питання не про застосунок — можеш відповісти загально, але не вигадуй функцій, яких немає в описі контексту.`;

function sanitizeMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;
    const trimmed = content.trim().slice(0, MAX_CONTENT_LEN);
    out.push({ role, content: trimmed });
  }
  return out.length ? out : null;
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
}

function getGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim()
  );
}

export async function POST(req: Request) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Асистент не налаштований: додайте GEMINI_API_KEY (Google AI Studio → Get API key) у .env.local або Vercel і зробіть Redeploy.',
      },
      { status: 503 },
    );
  }

  let body: { messages?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некоректний JSON' }, { status: 400 });
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages) {
    return NextResponse.json({ error: 'Очікується messages: масив { role: user|assistant, content: string }' }, { status: 400 });
  }

  const context =
    typeof body.context === 'string' && body.context.trim()
      ? `\n\nКонтекст з відкритого зараз екрану турніру:\n${body.context.trim().slice(0, 2000)}`
      : '';

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';

  const systemText = SYSTEM_PROMPT + context;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: toGeminiContents(messages),
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = (await res.json()) as {
      error?: { message?: string; status?: string };
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    if (!res.ok) {
      const msg = data.error?.message ?? `Gemini HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
      return NextResponse.json(
        { error: `Запит заблоковано політиками безпеки (${blockReason}). Спробуйте переформулювати питання.` },
        { status: 400 },
      );
    }

    const parts = data.candidates?.[0]?.content?.parts;
    const text = parts?.map((p) => p.text ?? '').join('').trim();
    if (!text) {
      const reason = data.candidates?.[0]?.finishReason;
      return NextResponse.json(
        {
          error: reason
            ? `Порожня відповідь (finishReason: ${reason}).`
            : 'Порожня відповідь від моделі.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Помилка з’єднання з Gemini';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

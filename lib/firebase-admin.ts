import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;

function readServiceAccountFile(relOrAbs: string): string {
  const resolved = isAbsolute(relOrAbs) ? relOrAbs : join(process.cwd(), relOrAbs);
  if (!existsSync(resolved)) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT_PATH file not found: ${resolved}. Use path relative to project root or absolute path.`,
    );
  }
  return readFileSync(resolved, 'utf8').trim();
}

/** Рядок схожий на base64 без JSON-об’єкта (лапки в Vercel часто ламають перевірку). */
function looksLikeBase64Payload(s: string): boolean {
  const compact = s.replace(/\s/g, '');
  return compact.length >= 80 && /^[A-Za-z0-9+/=_-]+$/.test(compact) && !compact.includes('{');
}

/** З буфера обміну часто потрапляють зайві символи — лишаємо лише алфавіт base64. */
function onlyBase64Alphabet(s: string): string {
  return s.replace(/[^A-Za-z0-9+/=_-]/g, '');
}

/** Кандидати для декоду: цілий рядок і довгі токени (без префіксів на кшталт «Варіант B:»). */
function base64DecodeCandidates(s: string): string[] {
  const t = normalizeServiceAccountJsonString(s);
  const out: string[] = [];
  const push = (x: string) => {
    const c = onlyBase64Alphabet(x);
    if (c.length >= 80 && !c.includes('{')) out.push(c);
  };
  push(t);
  for (const part of t.split(/[\s,;|]+/)) {
    if (part.length >= 40) push(part);
  }
  return [...new Set(out)];
}

/** BOM, зайві лапки навколо всього JSON у .env — часта причина невалідного JSON. */
function normalizeServiceAccountJsonString(s: string): string {
  let t = s.trim();
  if (t.charCodeAt(0) === 0xfeff) {
    t = t.slice(1).trim();
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'") && t.includes('{')) {
    t = t.slice(1, -1).trim();
  }
  // Подвійні лапки навколо JSON-об’єкта
  if (t.length >= 4 && t.startsWith('"') && t.endsWith('"') && t.slice(1, -1).trim().startsWith('{')) {
    t = t.slice(1, -1).trim();
  }
  // Те саме навколо base64: всередині немає "{" на початку — раніше лапки не знімались і base64 ламався
  else if (t.length >= 4 && t.startsWith('"') && t.endsWith('"')) {
    const inner = t.slice(1, -1).trim();
    if (looksLikeBase64Payload(inner)) {
      t = inner;
    }
  }
  return t;
}

function looksLikeBase64Only(s: string): boolean {
  return looksLikeBase64Payload(s);
}

/** Парсить JSON ключа; підтримує JSON-рядок з об'єктом всередині та base64(Vercel без «лапкового пекла»). */
function tryParseServiceAccountJson(raw: string, decodeDepth = 0): Record<string, unknown> | null {
  if (decodeDepth > 4) return null;

  const s = normalizeServiceAccountJsonString(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(s);
  } catch {
    if (looksLikeBase64Only(s)) {
      const compact = s.replace(/\s/g, '');
      for (const enc of ['base64', 'base64url'] as const) {
        try {
          const decoded = Buffer.from(compact, enc).toString('utf8');
          const nested = tryParseServiceAccountJson(decoded, decodeDepth + 1);
          if (nested) return nested;
        } catch {
          /* пробуємо наступне кодування */
        }
      }
    }
    return null;
  }

  if (typeof parsed === 'string') {
    const inner = parsed.trim();
    if (!inner.startsWith('{')) return null;
    try {
      parsed = JSON.parse(inner);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.private_key === 'string' && typeof o.client_email === 'string') {
    return o;
  }
  return null;
}

const DEFAULT_SERVICE_ACCOUNT_FILE = 'service-account.json';

/**
 * Порядок важливий: спочатку файл (надійніший локально), останнім — рядок у .env.
 * Так битий/обрізаний FIREBASE_SERVICE_ACCOUNT_JSON не блокує валідний service-account.json у корені.
 */
function loadServiceAccountCreds(): Record<string, unknown> {
  const attempts: Array<{ label: string; raw: string }> = [];

  const pathVar = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const defaultAbs = join(process.cwd(), DEFAULT_SERVICE_ACCOUNT_FILE);

  const pushFile = (relOrAbs: string, label: string) => {
    try {
      attempts.push({ label, raw: readServiceAccountFile(relOrAbs) });
    } catch {
      /* файл відсутній або шлях невірний — пропускаємо */
    }
  };

  if (pathVar) {
    pushFile(pathVar, `FIREBASE_SERVICE_ACCOUNT_PATH (${pathVar})`);
  } else if (existsSync(defaultAbs)) {
    pushFile(DEFAULT_SERVICE_ACCOUNT_FILE, `${DEFAULT_SERVICE_ACCOUNT_FILE} (корінь проєкту, авто)`);
  }

  /** Окрема змінна лише для base64 — зручно для Vercel (без плутанини з JSON). */
  const inlineB64Only = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64?.trim();
  if (inlineB64Only) {
    attempts.push({ label: 'FIREBASE_SERVICE_ACCOUNT_JSON_B64', raw: inlineB64Only });
  }

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    attempts.push({ label: 'FIREBASE_SERVICE_ACCOUNT_JSON', raw: inline });
  }

  if (!attempts.length) {
    throw new Error(
      `Додайте ключ: файл ${DEFAULT_SERVICE_ACCOUNT_FILE} у корінь проєкту, або FIREBASE_SERVICE_ACCOUNT_PATH, або FIREBASE_SERVICE_ACCOUNT_JSON (Vercel).`,
    );
  }

  const errors: string[] = [];
  for (const { label, raw } of attempts) {
    const creds = tryParseServiceAccountJson(raw);
    if (creds) return creds;
    errors.push(
      `${label}: невалідний JSON або немає private_key/client_email.`,
    );
  }

  throw new Error(
    `Ключ service account не підійшов: ${errors.join(' | ')} Локально: service-account.json у корінь. На Vercel: npm run firebase:env-one-line → base64 у FIREBASE_SERVICE_ACCOUNT_JSON_B64 (рекомендовано) або JSON у FIREBASE_SERVICE_ACCOUNT_JSON, Redeploy.`,
  );
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;

  const creds = loadServiceAccountCreds();

  let app: App;
  if (!getApps().length) {
    app = initializeApp({ credential: cert(creds as Parameters<typeof cert>[0]) });
  } else {
    app = getApps()[0]!;
  }

  cachedDb = getFirestore(app);
  return cachedDb;
}

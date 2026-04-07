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

/** BOM, зайві лапки навколо всього JSON у .env — часта причина невалідного JSON. */
function normalizeServiceAccountJsonString(s: string): string {
  let t = s.trim();
  if (t.charCodeAt(0) === 0xfeff) {
    t = t.slice(1).trim();
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'") && t.includes('{')) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** Парсить JSON ключа; підтримує випадок, коли в .env усе значення — JSON-рядок з об'єктом всередині. */
function tryParseServiceAccountJson(raw: string): Record<string, unknown> | null {
  const s = normalizeServiceAccountJsonString(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
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
    `Ключ service account не підійшов: ${errors.join(' | ')} Локально: покладіть свіжий JSON як service-account.json у корінь і приберіть або виправте FIREBASE_SERVICE_ACCOUNT_JSON у .env.local. На Vercel — один рядок JSON у змінній без переносів.`,
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

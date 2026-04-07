const WRITE_LOG = '[Tournament API write]';

function formatWriteFailure(status: number, serverError: string | undefined): string {
  const detail = (serverError ?? '').trim();
  if (status === 401) {
    return 'Невірний пароль для запису. Вийдіть із режиму адміна й увійдіть знову тим самим значенням, що й TOURNAMENT_ADMIN_SECRET у .env.local / Vercel.';
  }
  if (status === 503) {
    return 'Сервер не налаштований для записів: у .env.local задайте TOURNAMENT_ADMIN_SECRET і ключ сервісу — або FIREBASE_SERVICE_ACCOUNT_JSON (одним рядком), або FIREBASE_SERVICE_ACCOUNT_PATH=service-account.json (файл у корені проєкту). Перезапустіть npm run dev. На Vercel — ті самі змінні в Environment Variables + Redeploy.';
  }
  if (detail) {
    if (/already exists/i.test(detail)) {
      return `Категорія вже є в базі: ${detail}. Оберіть інший ID або видаліть стару.`;
    }
    if (/FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_SERVICE_ACCOUNT_PATH|valid JSON|file not found/i.test(detail)) {
      return `Помилка сервера (ключ сервісу): ${detail}. Локально: FIREBASE_SERVICE_ACCOUNT_PATH=service-account.json або один рядок FIREBASE_SERVICE_ACCOUNT_JSON у .env.local.`;
    }
    if (/PERMISSION_DENIED|permission/i.test(detail)) {
      return `Доступ до Firestore заборонено для service account: ${detail}. У Google Cloud → IAM надайте ролі з доступом до Firestore для цього акаунта.`;
    }
    if (/UNAVAILABLE|ECONNREFUSED|ETIMEDOUT|connect/i.test(detail)) {
      return `Сервер не зміг з’єднатись з Firestore: ${detail}. Зазвичай це тимчасова мережа або блокування з боку хостингу.`;
    }
    return detail;
  }
  return `Запис не вдався (HTTP ${status}).`;
}

export async function tournamentWriteOp(
  op: string,
  payload: Record<string, unknown>,
  adminSecret: string | null,
): Promise<void> {
  const secret = adminSecret?.trim();
  if (!secret) {
    console.error(`${WRITE_LOG} Немає adminWriteSecret — увімкніть Admin Mode і введіть пароль.`, { op });
    throw new Error('Потрібен пароль адміна для запису. Увімкніть режим адміна ще раз.');
  }

  let res: Response;
  try {
    res = await fetch('/api/tournament/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': secret,
      },
      body: JSON.stringify({ op, payload }),
    });
  } catch (err) {
    console.error(`${WRITE_LOG} fetch не виконався (мережа / URL):`, { op, err });
    throw new Error(
      'Не вдалось звернутись до API запису (/api/tournament/write). Перевірте інтернет або чи задеплоєно цей самий Next.js-проєкт (не лише статичний хостинг).',
    );
  }

  let json: { ok?: boolean; error?: string } = {};
  const rawTextRef = { t: '' as string };
  try {
    const text = await res.text();
    rawTextRef.t = text.slice(0, 2000);
    json = text ? (JSON.parse(text) as typeof json) : {};
  } catch {
    // ignore parse
  }

  if (!res.ok) {
    const preview = (rawTextRef.t || '').slice(0, 800).replace(/\s+/g, ' ').trim();
    const line = `${WRITE_LOG} HTTP ${res.status} op=${op} error=${JSON.stringify(json.error)} body=${preview || '(empty)'}`;
    console.error(line);
    let msg = formatWriteFailure(res.status, json.error);
    if (json.error && !msg.includes(String(json.error))) {
      msg = `${msg} (${json.error})`;
    }
    throw new Error(msg);
  }
}

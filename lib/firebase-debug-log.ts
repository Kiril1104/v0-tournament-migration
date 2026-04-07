/**
 * Детальні логи в консоль браузера для діагностики Firestore / env.
 * Префікс: шукайте "[Tournament Firebase]" у DevTools → Console.
 */
import {
  getClientFirebaseEnvFlags,
  getMissingClientFirebaseEnvKeys,
  FIREBASE_CONSOLE_COPY_GUIDE,
} from '@/lib/firebase-client-env';

const P = '[Tournament Firebase]';

export function logFirebaseEnvOnClientMount(): void {
  if (typeof window === 'undefined') return;

  const flags = getClientFirebaseEnvFlags();
  const missing = getMissingClientFirebaseEnvKeys();

  console.groupCollapsed(`${P} NEXT_PUBLIC_* у цій збірці (лише так/ні, без секретів)`);
  console.table(flags);
  if (missing.length > 0) {
    console.error(`${P} Немає з’єднання з Firestore: у бандл не потрапили змінні:`, missing);
    console.info(`${P} Що скопіювати з Firebase Console:\n`, FIREBASE_CONSOLE_COPY_GUIDE);
  } else {
    console.info(`${P} Усі 6 змінних є в клієнтській збірці. Якщо помилки лишаються — див. code у onSnapshot нижче та обмеження API key (referrer).`);
  }
  console.groupEnd();
}

export function logFirestoreDbInitialized(projectId: string | undefined, initPath: string): void {
  if (typeof window === 'undefined') return;
  console.info(`${P} getDb() готовий. projectId="${projectId ?? ''}" шлях ініціалізації: ${initPath}`);
}

export function logEnableNetworkError(error: unknown): void {
  if (typeof window === 'undefined') return;
  const e = error as { code?: string; message?: string };
  console.warn(`${P} enableNetwork не вдався (часто не критично):`, e?.code, e?.message, error);
}

/** Деталі помилки з onSnapshot / Firestore. */
export function logFirestoreSnapshotError(listenPath: string, error: unknown): void {
  if (typeof window === 'undefined') return;
  const e = error as {
    code?: string;
    message?: string;
    name?: string;
    stack?: string;
    customData?: unknown;
    toString?: () => string;
  };
  console.error(`${P} onSnapshot "${listenPath}"`, {
    code: e.code,
    message: e.message,
    name: e.name,
    customData: e.customData,
    stack: e.stack,
    raw: error,
  });
  if (e.code === 'permission-denied') {
    console.info(`${P} permission-denied: перевірте правила Firestore у консолі Firebase та чи projectId у збірці = проєкту з БД.`);
  }
  if (e.code === 'unavailable' || /network|fetch|offline/i.test(String(e.message))) {
    console.info(`${P} unavailable/network: інтернет, VPN, блокувальники, обмеження Web API key (HTTP referrers) у Google Cloud.`);
  }
}

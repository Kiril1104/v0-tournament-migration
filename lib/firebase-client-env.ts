/** Усі поля з об’єкта `firebaseConfig` у Firebase Console → веб-застосунок. */
export const CLIENT_FIREBASE_ENV_KEYS = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

export type ClientFirebaseEnvKey = (typeof CLIENT_FIREBASE_ENV_KEYS)[number];

/** Що реально потрапило в клієнтську збірку (лише так/ні — без секретів). */
export function getClientFirebaseEnvFlags(): Record<ClientFirebaseEnvKey, boolean> {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim()),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim()),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    ),
    NEXT_PUBLIC_FIREBASE_APP_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()),
  };
}

export function getMissingClientFirebaseEnvKeys(): ClientFirebaseEnvKey[] {
  const flags = getClientFirebaseEnvFlags();
  return CLIENT_FIREBASE_ENV_KEYS.filter((k) => !flags[k]);
}

export function isClientFirebaseEnvReady(): boolean {
  return getMissingClientFirebaseEnvKeys().length === 0;
}

export const CLIENT_FIREBASE_ENV_HINT_UA =
  'Немає з’єднання з Firestore у браузері: у збірці відсутні одна або кілька змінних NEXT_PUBLIC_FIREBASE_*.\n\n' +
  'Скопіюйте з Firebase Console → Project settings → Your apps → веб-додаток усі 6 полів у Vercel (назви змінних мають збігатися дослівно):\n' +
  'NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID.\n\n' +
  'У Vercel для кожної змінної увімкніть Preview і Production → Save → Redeploy (без нового деплою NEXT_PUBLIC не оновляться).';

/** Текст для консолі: що саме копіювати з Firebase. */
export const FIREBASE_CONSOLE_COPY_GUIDE = `
Firebase Console → ⚙ Project settings → вкладка "General" → блок "Your apps" → веб-додаток (або "Add app" → Web).

У об'єкті firebaseConfig поля такі (імена в консолі → змінна в .env / Vercel):

  apiKey                  → NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain              → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId               → NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket           → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId       → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId                   → NEXT_PUBLIC_FIREBASE_APP_ID

У Vercel: Environment Variables → для кожної змінної увімкнути Preview + Production → Save → Redeploy.
`.trim();

export const FIRESTORE_EXTRA_HINT_WHEN_ENV_OK_UA =
  '\n\nЯкщо всі 6 змінних у збірці є (див. блок «Діагностика» нижче) і був Redeploy:\n' +
  '• Google Cloud → APIs & Services → Credentials → Web API Key → HTTP referrers: додайте https://*.vercel.app/* та ваш домен. Або тимчасово «None» для перевірки.\n' +
  '• Firebase Console → App Check: якщо увімкнено для Firestore без інтеграції в цей застосунок — тимчасово вимкніть або додайте debug token.\n' +
  '• Firestore Database має бути створена; правила — дозволити read (у репозиторії firestore.rules вже allow read, якщо ви їх задеплоїли).\n' +
  '• Інший браузер, без VPN, без блокувальників.';

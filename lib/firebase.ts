import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { isClientFirebaseEnvReady } from '@/lib/firebase-client-env';
import { logFirestoreDbInitialized } from '@/lib/firebase-debug-log';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseApp: FirebaseApp | null = null;

/**
 * Lazy init: у браузері не викликаємо `initializeApp`, доки немає NEXT_PUBLIC_* —
 * інакше з’являється «напівзламаний» клієнт Firestore.
 */
function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  const existing = getApps()[0];
  if (existing) {
    firebaseApp = existing;
    return firebaseApp;
  }
  if (typeof window !== 'undefined' && !isClientFirebaseEnvReady()) {
    const err = new Error(
      'Firebase web: задайте всі 6 NEXT_PUBLIC_FIREBASE_* з консолі Firebase, зробіть Redeploy. Деталі в консолі браузера [Tournament Firebase].',
    );
    console.error('[Tournament Firebase] getFirebaseApp(): конфіг не готовий — getDb() не викликати до виправлення env.');
    throw err;
  }
  firebaseApp = initializeApp(firebaseConfig);
  return firebaseApp;
}

let firestoreInstance: Firestore | null = null;

/**
 * Browser: memory cache + long-polling (offline/proxy).
 * Server: default Firestore для рідкісних SSR-викликів.
 * Не обгортайте в Proxy.
 */
export function getDb(): Firestore {
  if (firestoreInstance) return firestoreInstance;

  if (typeof window === 'undefined') {
    firestoreInstance = getFirestore(getFirebaseApp());
    return firestoreInstance;
  }

  const app = getFirebaseApp();
  let initPath = 'getFirestore(default)';

  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalAutoDetectLongPolling: true,
    });
    initPath = 'initializeFirestore(memoryLocalCache + experimentalAutoDetectLongPolling)';
  } catch (firstErr) {
    console.warn('[Tournament Firebase] Перший варіант initializeFirestore не вдався, fallback…', firstErr);
    try {
      firestoreInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
      initPath = 'initializeFirestore(experimentalForceLongPolling)';
    } catch (secondErr) {
      console.warn('[Tournament Firebase] Другий fallback initializeFirestore не вдався, getFirestore()', secondErr);
      firestoreInstance = getFirestore(app);
      initPath = 'getFirestore(fallback)';
    }
  }

  logFirestoreDbInitialized(app.options.projectId, initPath);
  return firestoreInstance;
}

/**
 * Класичний Firebase-патерн: `const app = initializeApp(config); export const db = getFirestore(app);`
 * Тут ініціалізація лінива (env у браузері), тому експортуємо ті самі функції під іменами `app` та `db`.
 * У коді: `collection(db(), 'categories')` — еквівалент `getFirestore(app())`.
 */
export { getFirebaseApp as app, getDb as db };

import { getDoc, getDocFromCache, type DocumentReference } from 'firebase/firestore';

export function isFirestoreOfflineLike(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';
  return (
    code === 'unavailable' ||
    /offline|Failed to get document because the client is offline/i.test(msg) ||
    /Could not reach Cloud Firestore/i.test(msg)
  );
}

/** Prefer server read; if "offline", fall back to cache-only read for existence checks. */
export async function docExistsWithOfflineFallback(ref: DocumentReference): Promise<boolean> {
  try {
    return (await getDoc(ref)).exists();
  } catch (e) {
    if (!isFirestoreOfflineLike(e)) throw e;
    try {
      return (await getDocFromCache(ref)).exists();
    } catch {
      throw new Error(
        'Немає зʼєднання з Firestore. Спробуй: інший Wi‑Fi, вимкнути VPN, Ctrl+F5, або очистити дані сайту (у т.ч. IndexedDB) і відкрити сторінку знову. Можна спробувати інший браузер.',
      );
    }
  }
}

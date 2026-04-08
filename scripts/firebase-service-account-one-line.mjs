/**
 * Генерує значення для Vercel: валідний один рядок JSON або base64 від нього.
 * Запуск: node scripts/firebase-service-account-one-line.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const filePath = path.join(root, 'service-account.json');

if (!fs.existsSync(filePath)) {
  console.error('Немає service-account.json у корені проєкту. Завантажте ключ у Firebase Console → Project settings → Service accounts.');
  process.exit(1);
}

let obj;
try {
  obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (e) {
  console.error('service-account.json не є валідним JSON:', e.message);
  process.exit(1);
}

if (typeof obj?.private_key !== 'string' || typeof obj?.client_email !== 'string') {
  console.error('У JSON немає полів private_key / client_email — це не ключ service account.');
  process.exit(1);
}

const oneLine = JSON.stringify(obj);
const b64 = Buffer.from(oneLine, 'utf8').toString('base64');

console.log('Vercel → Settings → Environment Variables (Production + Preview) → Redeploy.\n');
console.log('Найнадійніше для base64: окрема змінна FIREBASE_SERVICE_ACCOUNT_JSON_B64 = лише рядок нижче (без лапок, без префіксів).\n');
console.log(b64);
console.log('\n--- Або один рядок у FIREBASE_SERVICE_ACCOUNT_JSON (JSON) ---\n');
console.log(oneLine);
console.log('');

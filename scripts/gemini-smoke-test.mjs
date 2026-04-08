/**
 * Мінімальний запит до Gemini API (той самий endpoint, що й у застосунку).
 * Запуск: npm run gemini:check
 * Ключ береться з .env.local через --env-file (не логуйте вивід у публічні місця).
 */
const key =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
  process.env.GOOGLE_AI_API_KEY?.trim();

const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite';

if (!key) {
  console.error('Помилка: немає GEMINI_API_KEY у змінних оточення.');
  console.error('Запустіть з кореня проєкту: npm run gemini:check');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Відповідь одним словом: OK' }] }],
    generationConfig: { maxOutputTokens: 32, temperature: 0 },
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error('--- Результат: ПОМИЛКА ---');
  console.error('HTTP статус:', res.status);
  console.error('Модель:', model);
  console.error('Тіло відповіді (без ключа):');
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const text =
  data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')?.trim() ?? '';

console.log('--- Результат: УСПІХ ---');
console.log('Модель:', model);
console.log('Фрагмент відповіді:', text.slice(0, 120) || '(порожньо)');
console.log('Повна відповідь API (кандидат):', JSON.stringify(data.candidates?.[0] ?? null, null, 2).slice(0, 500));

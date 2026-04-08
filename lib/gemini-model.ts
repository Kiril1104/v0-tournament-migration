/**
 * Модель за замовчуванням для Gemini API (асистент + AI-імпорт розкладу).
 * Перевизначте через GEMINI_MODEL у .env — див. https://ai.google.dev/gemini-api/docs/models
 *
 * Використовуємо актуальну легку модель 2.5 замість застарілого gemini-2.0-flash,
 * щоб рідше впертися в «quota … limit: 0» на безкоштовному рівні для старих імен моделей.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

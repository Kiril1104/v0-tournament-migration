/**
 * Ключ Gemini з оточення (не хардкодити в репозиторії).
 * Локально: `.env.local` → `GEMINI_API_KEY=ваш_ключ`
 * Vercel: Environment Variables → `GEMINI_API_KEY`
 */
export function getGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim()
  );
}

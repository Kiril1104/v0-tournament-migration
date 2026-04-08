const QUOTA_UA =
  'Перевищено квоту Google Gemini для вашого API-ключа (безкоштовний ліміт вичерпано або для цієї моделі ліміт 0). ' +
  'Перевірте план і білінг у Google AI Studio; ліміти: https://ai.google.dev/gemini-api/docs/rate-limits ' +
  'Можна спробувати іншу модель у змінній середовища GEMINI_MODEL (наприклад gemini-2.5-flash або gemini-2.5-flash-lite) і зробити Redeploy. ' +
  'Якщо з’явилось «retry in Ns» — зачекайте і повторіть запит.';

/**
 * Перетворює сиру відповідь помилки Gemini REST API на зрозуміле повідомлення та HTTP-статус для клієнта.
 * @param apiErrorCode — поле error.code з JSON відповіді (часто 429 при перевищенні квоти).
 */
export function userMessageFromGeminiApiError(
  apiMessage: string,
  httpStatus: number,
  apiErrorCode?: number,
): { message: string; status: number } {
  const lower = apiMessage.toLowerCase();
  const quotaLike =
    httpStatus === 429 ||
    apiErrorCode === 429 ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('exceeded your current quota');

  if (quotaLike) {
    return { message: QUOTA_UA, status: 429 };
  }

  const clientStatus = httpStatus >= 400 && httpStatus < 600 ? httpStatus : 502;
  return { message: apiMessage, status: clientStatus };
}

# Чеклист перед redeploy (Vercel)

## 1. Змінні в Vercel

**Project → Settings → Environment Variables**

Для кожної змінної з `.env.example` увімкніть **Preview** і **Production** (якщо користуєтеся preview-URL).

| Група | Навіщо |
|--------|--------|
| Усі `NEXT_PUBLIC_FIREBASE_*` | Клієнтський Firestore (списки, live-оновлення) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Записи через `/api/tournament/write` |
| `TOURNAMENT_ADMIN_SECRET` | Має збігатися з паролем адміна в додатку |
| `NEXT_PUBLIC_ADMIN_PASSWORD` | (Опційно) той самий пароль, що й секрет вище |
| `GEMINI_API_KEY` | (Опційно) чат-асистент |

`FIREBASE_SERVICE_ACCOUNT_JSON` — **один рядок** валідного JSON (ключ сервісного акаунта з Firebase).

## 2. Redeploy

**Deployments** → останній деплой → **⋯** → **Redeploy**.

Після зміни `NEXT_PUBLIC_*` без нового деплою браузер не побачить оновлених значень.

## 3. Локально

```bash
cp .env.example .env.local
# заповніть .env.local
npm install
npm run build
```

Якщо `npm run build` проходить — зазвичай збереться й на Vercel (якщо змінні задані в проєкті).

## 4. Після деплою — швидка перевірка

- Відкрити сайт: жовтий блок «Діагностика Firebase» — усі пункти ✓.
- Увімкнути Admin, додати тестову категорію (якщо налаштовані секрет і service account).
- Відкрити «Асистент» — якщо задано `GEMINI_API_KEY`, відповідь має приходити.

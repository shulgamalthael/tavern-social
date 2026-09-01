/**
 * Имя cookie временной сессии. Общая константа для `proxy.ts` (edge-проверка
 * присутствия сессии) и `features/auth` (создание/чтение/удаление сессии) —
 * единственное, что должно знать про сессию за пределами `features/auth`.
 */
export const SESSION_COOKIE_NAME = 'tavern_session';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Опции httpOnly cookie сессии — общие для `features/auth/api/actions.ts`
 * (email/password вход) и `app/auth/callback/route.ts` (Google-вход): оба
 * места пишут cookie ровно одинаково, значение отличается только источником
 * токена. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

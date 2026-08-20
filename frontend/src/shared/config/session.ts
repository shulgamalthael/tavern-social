/**
 * Имя cookie временной сессии. Общая константа для `proxy.ts` (edge-проверка
 * присутствия сессии) и `features/auth` (создание/чтение/удаление сессии) —
 * единственное, что должно знать про сессию за пределами `features/auth`.
 */
export const SESSION_COOKIE_NAME = 'tavern_session';

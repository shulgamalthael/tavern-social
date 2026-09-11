export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Целевая дата уже прошла (или не распознана) — рендерер должен показать
   * `expiredText` вместо цифр, а не «00:00:00:00» навсегда тикающий ноль. */
  isPast: boolean;
}

const ZERO_PARTS: CountdownParts = { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };

/**
 * Чистая функция разбора «сколько осталось» до `targetIso` — вынесена сюда
 * (а не прямо в `CountdownRenderer`/`CountdownBarRenderer`,
 * `blocks/content/index.tsx`) специально, чтобы её можно было юнит-тестить
 * без React/DOM (см. `frontend/vitest.config.mts`: `include` — только
 * `src/**\/*.test.ts`, компонентных тестов в проекте нет). Невалидную/уже
 * прошедшую дату трактует как `isPast: true`, а не бросает — рендерер тогда
 * просто показывает `expiredText`, а не падает на плохом пользовательском
 * вводе (дата в `props` — обычная текстовая строка, `control: 'text'`, ни
 * билдер, ни AI не гарантируют валидный ISO).
 */
export function getCountdownParts(targetIso: string, now: Date = new Date()): CountdownParts {
  const target = new Date(targetIso).getTime();
  if (!Number.isFinite(target)) return ZERO_PARTS;

  const diffMs = target - now.getTime();
  if (diffMs <= 0) return ZERO_PARTS;

  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isPast: false,
  };
}

/** Компактная строка `12д 04ч 33м 12с` для узких мест (`countdownbar`) —
 * `countdown` (крупные блоки) верстает те же поля сам, через JSX, а не эту
 * функцию. */
export function formatCountdownCompact(parts: CountdownParts): string {
  if (parts.isPast) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.days}д ${pad(parts.hours)}ч ${pad(parts.minutes)}м ${pad(parts.seconds)}с`;
}

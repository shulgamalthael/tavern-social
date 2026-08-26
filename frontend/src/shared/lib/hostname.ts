/** Тот же принцип нормализации, что и на backend (см. `backend/src/modules/
 * domains/lib/hostname.ts`) — регистр/порт/завершающая точка не должны
 * влиять на сравнение хоста: `EXAMPLE.COM`, `example.com.` и `example.com`
 * должны считаться одним и тем же адресом. Отдельная копия здесь (не общий
 * пакет между frontend/backend) — тот же осознанный компромисс, что и у
 * остальных дублированных DTO-типов проекта (см. AGENTS.md backend). */
export function normalizeHostname(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

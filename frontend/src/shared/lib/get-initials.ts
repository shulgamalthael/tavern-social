/** Инициалы из первых двух слов имени, например «Аля Кравец» → «АК». */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

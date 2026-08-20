export type ClassValue = string | false | null | undefined;

/** Склеивает переданные классы, отбрасывая falsy-значения. */
export function cn(...classNames: ClassValue[]): string {
  return classNames.filter(Boolean).join(' ');
}

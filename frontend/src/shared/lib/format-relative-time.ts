import { pluralizeRu } from './pluralize-ru';

/** «2 часа назад», «5 минут назад», «только что» и т. п. из ISO-даты. */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (diffSeconds < 60) return 'только что';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} ${pluralizeRu(diffMinutes, ['минуту', 'минуты', 'минут'])} назад`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ${pluralizeRu(diffHours, ['час', 'часа', 'часов'])} назад`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} ${pluralizeRu(diffDays, ['день', 'дня', 'дней'])} назад`;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

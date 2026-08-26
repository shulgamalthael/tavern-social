/** Транслитерация кириллицы — большинство названий бизнесов в Таверне будут
 * на русском (см. `seed.ts`, весь остальной контент проекта), а `slug`
 * должен быть читаемым URL-сегментом латиницей, не URL-энкодингом кириллицы
 * или пустой строкой после отбрасывания недопустимых символов. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const FALLBACK_SLUG = 'business';

/** Название бизнеса → черновой slug (без проверки уникальности — та требует
 * похода в БД, см. `BusinessesService.resolveSlug`, который вызывает эту
 * функцию и затем подбирает свободный вариант). */
export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || FALLBACK_SLUG;
}

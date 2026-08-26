/** Транслитерация кириллицы — большинство заголовков в Таверне будут на
 * русском (названия бизнесов, страниц сайта), а slug должен быть читаемым
 * URL-сегментом латиницей, не URL-энкодингом кириллицы или пустой строкой
 * после отбрасывания недопустимых символов. Тот же алфавит, что и у
 * backend-версии (`businesses/lib/slugify.ts`) — здесь не для проверки
 * уникальности (та требует похода в БД и остаётся на сервере), а для
 * черновой генерации slug страницы сайта прямо в билдере, до сохранения. */
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

const FALLBACK_SLUG = 'page';

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

/**
 * Compliance rule-engine v1 (закрывает §68's "restricted-category/age/
 * region rule engine" в части restricted categories) — владелец явно
 * выбрал проверку ПО КЛЮЧЕВЫМ СЛОВАМ в headline/description креатива, не
 * по категории бизнеса (существующая `BusinessCategory` — restaurant/
 * retail/services/... — не содержит ни одной классически ограниченной в
 * рекламе темы). Список — редактируемый черновик (тот же принцип, что
 * `AD_SLOT_ENTITLEMENTS`/`AD_PLACEMENT_ALLOWED_FORMATS` — "editable draft",
 * не финальная таксономия): владелец выбрал темы «Алкоголь», «Азарт/
 * гэмблинг», «Взрослый/18+ контент» как актуальные сейчас; «Оружие»,
 * «Рецептурные препараты», «Крипта», «Микрозаймы» — названы владельцем как
 * возможные следующие темы, но не выбраны в этом слайсе — добавляются той
 * же формой (новый ключ объекта), без миграции.
 *
 * Русские и английские формы вперемешку — платформа русскоязычная, но
 * креативы/названия товаров нередко на английском. Подстрока, без учёта
 * регистра — простая, объяснимая проверка, не NLP/ML-классификатор
 * (несоразмерно этому слайсу). Честно названный компромисс: подстрочный
 * поиск даёт ложные срабатывания на составных словах (например, «казино»
 * внутри слова «казиномания» или названия несвязанного бизнеса) — тот же
 * уровень простой эвристики, что и остальные явно названные упрощения
 * проекта, не скрытый баг.
 */
export const RESTRICTED_KEYWORD_TOPICS: Record<string, string[]> = {
  Алкоголь: [
    'пиво',
    'вино',
    'водка',
    'виски',
    'коньяк',
    'алкогол',
    'ликёр',
    'ликер',
    'шампанское',
    'beer',
    'wine',
    'vodka',
    'whisky',
    'whiskey',
    'alcohol',
    'liquor',
  ],
  'Азарт/гэмблинг': [
    'казино',
    'ставки на спорт',
    'букмекер',
    'лотере',
    'слот-машин',
    'покер на деньги',
    'casino',
    'gambling',
    'sportsbook',
    'bookmaker',
    'lottery',
  ],
  'Взрослый/18+ контент': [
    'порно',
    'эротик',
    'секс-услуг',
    'интим-услуг',
    'onlyfans',
    'porn',
    'erotic',
    'adult content',
    'xxx',
  ],
};

/** Первое совпадение (тема + само слово) в `headline`/`description`
 * креатива, или `null`, если ничего не найдено. Ищет по ВСЕМ темам сразу,
 * не только по одной — вызывающему (`AdCampaignsService.addCreative`)
 * нужна только причина для `rejectionReason`, не полный список
 * совпадений. */
export function findRestrictedKeywordMatch(
  ...texts: (string | null | undefined)[]
): { topic: string; keyword: string } | null {
  const haystack = texts.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return null;

  for (const [topic, keywords] of Object.entries(RESTRICTED_KEYWORD_TOPICS)) {
    const keyword = keywords.find((word) => haystack.includes(word));
    if (keyword) return { topic, keyword };
  }
  return null;
}

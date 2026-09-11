import type { AdBillingModel } from '@prisma/client';

/** "Prior" CTR для `cpc`-кампании БЕЗ ЕЩЁ ни одного показа — без этого
 * новая `cpc`-кампания сравнивалась бы как ставка `0` (нет кликов без
 * показов) и никогда не выиграла бы первый показ вообще. 1% — стандартный
 * ad-tech дефолт для "средний CTR баннерной рекламы", не подобранное
 * наугад число (общеизвестный порядок величины для display-рекламы). */
export const DEFAULT_ASSUMED_CTR = 0.01;

export interface EffectiveBidInput {
  billingModel: AdBillingModel;
  bidCents: number;
  impressionsServed: number;
  clicksServed: number;
}

/**
 * Приводит `cpm`- и `cpc`-ставку к одному и тому же измерению — "ожидаемые
 * центы за 1000 показов" (eCPM) — чтобы `AdEngineService` мог честно
 * сравнивать кампании с РАЗНОЙ моделью биллинга в одном ранжировании (см.
 * `AdBillingModel`'s комментарий в schema.prisma про то, что раньше это
 * было явно названным упрощением "сравнивать bidCents как есть"). Для
 * `cpm` — сама ставка (уже в этом измерении). Для `cpc` — `bidCents *
 * CTR * 1000`, где CTR — НАКОПЛЕННЫЙ с начала кампании
 * `clicksServed / impressionsServed` (реальная история, не оценка "из
 * воздуха") или `DEFAULT_ASSUMED_CTR`, пока истории ещё нет.
 *
 * Чистая функция без Prisma/NestJS — та же причина, что у
 * `count-ad-slot-blocks.ts`/`ad-placement-config.ts`: юнит-тестируется
 * напрямую, не только живой проверкой.
 */
export function calculateEffectiveCpmCents(campaign: EffectiveBidInput): number {
  if (campaign.billingModel === 'cpm') return campaign.bidCents;

  const ctr =
    campaign.impressionsServed > 0
      ? campaign.clicksServed / campaign.impressionsServed
      : DEFAULT_ASSUMED_CTR;
  return campaign.bidCents * ctr * 1000;
}

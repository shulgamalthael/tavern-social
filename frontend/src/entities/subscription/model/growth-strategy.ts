/** Один этап пути роста бизнеса на тарифе — рендерится как раскрываемый шаг
 * в `GrowthStrategyPanel` (заголовок виден сразу, `description` — по клику).
 * Названо в бизнес-ценности ("Верните посетителей, которые не купили"), не
 * в терминах фичи ("Retargeting API") — см. §17 исходного brief'а "Growth &
 * Advertising Strategy": технический лимit/фича должны переводиться в
 * понятную пользователю пользу. */
export interface GrowthStage {
  id: string;
  title: string;
  description: string;
}

/** v0 — только `STATIC`: содержимое зашито per-тариф в `PLAN_CATALOG`
 * (одобрено как первый срез, см. implementation plan). `CATEGORY_DYNAMIC`
 * (генерация по категории бизнеса) и `AI_CUSTOM` (AI-генерируемая
 * персональная стратегия) — оба явно отложены: требуют системы feature
 * entitlements, которой в проекте пока нет (см. `PlanCardConfig`'s
 * комментарий) — значение поля уже заложено на будущее, чтобы не менять
 * форму данных, когда эти уровни появятся. */
export type GrowthStrategyCustomizationLevel = 'STATIC' | 'CATEGORY_DYNAMIC' | 'AI_CUSTOM';

export interface GrowthStrategy {
  title: string;
  stages: GrowthStage[];
  customizationLevel: GrowthStrategyCustomizationLevel;
}

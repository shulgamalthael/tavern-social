import { updateBusiness, type BusinessCapability } from '@/entities/business';
import { createProduct } from '@/entities/product';
import { createService } from '@/entities/service';
import type { StarterTemplate, WebsiteBlock } from '@/entities/website';

export interface ApplyStarterTemplateResult {
  blocks: WebsiteBlock[];
  /** Была ли вообще предпринята попытка сидинга (капабилити/товары/услуги)
   * — `false` для шаблонов без этих полей (сегодня `agency`/`local-
   * business`), вызывающий код не должен звать `onSeeded`-колбэк, если
   * сидить было нечего. */
  seeded: boolean;
  /** Сидинг — best-effort, не блокирует применение блоков (см. комментарий
   * ниже). `true`, если попытка была и что-то из неё не удалось. */
  seedError: boolean;
}

/**
 * Общая логика применения стартового шаблона (капабилити + примеры товаров/
 * услуг + сами блоки) — вынесена из `StarterTemplatePicker.tsx` (ручной
 * выбор пользователем), чтобы AI-4 onboarding (`WebsiteBuilderWidget.tsx`,
 * авто-применение шаблона, который выбрала модель через `create_business`,
 * см. AI_PLATFORM_ROADMAP.md §11) использовала РОВНО тот же код, а не
 * повторно писала capabilities-merge/seed-цикл. Живёт в `widgets/website-
 * builder/lib`, не в `entities/website`, намеренно — импортирует `entities/
 * business`/`entities/product`/`entities/service`, а `entities/website` не
 * имеет права на сайдвейз-импорты соседних `entities`-слайсов (см.
 * `StarterTemplate.capabilities`'s комментарий в `templates/index.ts`).
 *
 * Сидинг — удобство, не обязательное условие применения шаблона: блоки
 * (`template.build`) применяются всегда, даже если capabilities/seed-запросы
 * упали (тот же принцип, что и в исходном `StarterTemplatePicker.handlePick`).
 */
export async function applyStarterTemplate(
  businessId: string,
  businessName: string,
  template: StarterTemplate,
  existingCapabilities: string[],
): Promise<ApplyStarterTemplateResult> {
  const hasSeedWork =
    Boolean(template.capabilities?.length) ||
    Boolean(template.seedProducts?.length) ||
    Boolean(template.seedServices?.length);

  let seedError = false;
  if (hasSeedWork) {
    try {
      if (template.capabilities?.length) {
        const merged = Array.from(new Set([...existingCapabilities, ...template.capabilities]));
        await updateBusiness(businessId, { capabilities: merged as BusinessCapability[] });
      }
      for (const product of template.seedProducts ?? []) {
        await createProduct(businessId, product);
      }
      for (const service of template.seedServices ?? []) {
        await createService(businessId, service);
      }
    } catch {
      seedError = true;
    }
  }

  return { blocks: template.build(businessName), seeded: hasSeedWork, seedError };
}

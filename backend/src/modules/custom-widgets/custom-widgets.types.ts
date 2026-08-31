import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { CustomWidgetStatus } from '@prisma/client';
import type { WebsiteBlock } from '@/modules/websites/websites.types';
import {
  ALLOWED_BLOCK_TYPES,
  BLOCK_SCHEMAS,
  buildValidatedProps,
  isAllowedBlockType,
} from '@/modules/ai/tools/lib/add-block-schemas';

/** Один элемент `CreateCustomWidgetDto.schema`/`UpdateCustomWidgetDto.schema`
 * КАК ЕГО ПРИСЛАЛ владелец бизнеса — форма один в один с тем, что AI-2's
 * `add_block` уже принимает от модели (`blockType`/`props`), не случайное
 * совпадение: виджет в этой версии — именно композиция из ТЕХ ЖЕ curated
 * блоков, никакой новой формы. */
interface RawWidgetBlockInput {
  blockType?: unknown;
  props?: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Валидирует `CustomWidget.schema` КАК ЕГО ПРИСЛАЛ владелец бизнеса — тем же
 * принципом "не доверяем форме JSON-поля" (`AI_PLATFORM_ROADMAP.md §3`), что
 * `RulesService`'s `parseRuleCondition`/`parseRuleActions` (AI-5) и tool'ы
 * AI-2 сами. Переиспользует `BLOCK_SCHEMAS`/`buildValidatedProps` из
 * `add-block-schemas.ts` НАПРЯМУЮ, не копирует — один и тот же блок,
 * добавленный AI-инструментом `add_block` или сохранённый здесь как часть
 * виджета, проходит РОВНО одну и ту же проверку допустимых полей/типов
 * (см. `CustomWidget.schema`'s комментарий в схеме).
 *
 * Каждому блоку присваивается свежий `id` (`randomUUID()`), даже если
 * клиент прислал свой — сохранённый виджет ещё нигде не встроен в реальную
 * страницу в этой версии (см. `CustomWidgetsService`'s комментарий про то,
 * почему рендеринг/встраивание отложены), но id всё равно не должен
 * приходить от клиента: то же untrusted-input рассуждение, что и у `add_
 * block` (`AddBlockTool` тоже сам генерирует `id`, не берёт от модели).
 *
 * `image`/`button` (AI_PLATFORM_ROADMAP.md §9.6/§16 — расширение allowlist)
 * технически уже входят в `ALLOWED_BLOCK_TYPES`, но эта функция вызывает
 * `buildValidatedProps` БЕЗ `refs` (пустые множества по умолчанию) —
 * намеренно, не пробел: `parseWidgetSchema` вызывается на уровне DTO, без
 * `businessId` в сигнатуре (виджет ещё не привязан к бизнесу на этом шаге
 * валидации), поэтому `image.src` здесь всегда должен быть `null`, а
 * `button.url` — только `external`/`anchor`/`phone`/`email` (варианты, не
 * требующие проверки существования). Виджет с `page`/`addToCart`/
 * `bookAppointment`-ссылкой или непустым `src` сегодня отклоняется тут же,
 * как "должен ссылаться на существующий..." — безопасный отказ, не
 * ложное принятие. Прокинуть `businessId`-scoped `refs` сюда — отдельное
 * расширение (`CustomWidgetsService.create/update` уже знают `businessId`,
 * этой функции просто нужно его передать), не сделано в этой итерации.
 */
export function parseWidgetSchema(raw: unknown): WebsiteBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException('schema должен быть непустым массивом блоков');
  }

  return raw.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new BadRequestException(`schema[${index}] должен быть объектом`);
    }

    const { blockType, props } = item as RawWidgetBlockInput;
    if (typeof blockType !== 'string' || !isAllowedBlockType(blockType)) {
      throw new BadRequestException(
        `schema[${index}].blockType должен быть одним из: ${ALLOWED_BLOCK_TYPES.join(', ')}`,
      );
    }
    if (props !== undefined && !isPlainObject(props)) {
      throw new BadRequestException(`schema[${index}].props, если передан, должен быть объектом`);
    }

    let validatedProps: Record<string, unknown>;
    try {
      validatedProps = buildValidatedProps(BLOCK_SCHEMAS[blockType], props);
    } catch (error) {
      throw new BadRequestException(
        `schema[${index}]: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return { id: randomUUID(), type: blockType, props: validatedProps };
  });
}

export interface CustomWidgetDto {
  id: string;
  businessId: string;
  name: string;
  schema: WebsiteBlock[];
  status: CustomWidgetStatus;
  createdAt: string;
  updatedAt: string;
}

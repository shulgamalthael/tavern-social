import { BusinessCategory } from '@prisma/client';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { BusinessesService } from '@/modules/businesses/businesses.service';
import { SUPPORTED_CURRENCY_CODES } from '@/modules/currencies/currencies';
import type { OnboardingToolContext, OnboardingToolDefinition } from '../onboarding.types';
import { OnboardingToolRegistryService } from '../onboarding-tool-registry.service';

interface CreateBusinessInput {
  name: string;
  category: BusinessCategory;
  description?: string;
  currency?: string;
  templateId: TemplateId;
}

interface CreateBusinessOutput {
  businessId: string;
  slug: string;
  name: string;
  templateId: TemplateId;
}

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const CATEGORY_VALUES = Object.values(BusinessCategory);

/** Ручная копия id из `frontend/src/entities/website/templates/index.ts`'s
 * `STARTER_TEMPLATES` (плюс `'blank'` — "шаблон не подходит, ничего не
 * применяем") — тот же приём независимых копий одного контракта, что и у
 * currencies.ts/ai-chat model/types.ts (два TS-проекта без общего пакета
 * типов). Backend НЕ знает содержимого шаблонов (блоки, сид-товары) — только
 * то, что это валидный id, который позже подхватит `WebsiteBuilderWidget` на
 * frontend через `?template=` (см. AI_PLATFORM_ROADMAP.md §11.5). Добавили
 * новый шаблон во `STARTER_TEMPLATES` — добавьте его id и сюда. */
const TEMPLATE_IDS = ['restaurant', 'agency', 'local-business', 'blank'] as const;
type TemplateId = (typeof TEMPLATE_IDS)[number];

/**
 * Единственный инструмент AI-4 onboarding-диалога (AI_PLATFORM_ROADMAP.md
 * §2.7) — вызывает существующий `BusinessesService.create`, который уже
 * атомарно создаёт бизнес И его сайт одной транзакцией (см. её комментарий:
 * "на frontend нет состояния «бизнес есть, а сайта ещё нет»") — тот же
 * принцип "tool layer — новый вызывающий старого кода", что и у
 * `create_page`/`add_block` (AI_PLATFORM_ROADMAP.md §1).
 *
 * `medium`, не `high`: создание одного бизнеса — обычная, обратимая операция
 * (владелец может удалить бизнес так же, как только что созданную страницу
 * или блок) — тот же уровень риска, что и у остальных write-инструментов
 * проекта (`create_page`, `add_block`, см. их комментарии).
 */
@Injectable()
export class CreateBusinessTool implements OnModuleInit {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly toolRegistry: OnboardingToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: OnboardingToolDefinition<CreateBusinessInput, CreateBusinessOutput> = {
      name: 'create_business',
      description:
        'Создаёт новый бизнес с сайтом-заготовкой на платформе Tavern. Вызывай ТОЛЬКО когда у тебя уже есть от пользователя достаточно информации: название и категория обязательны, остальное можно уточнить или пропустить.',
      riskLevel: 'medium',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Название бизнеса, например "Кофейня на Хрещатику"',
          },
          category: {
            type: 'string',
            description: 'Категория бизнеса',
            enum: CATEGORY_VALUES,
          },
          description: {
            type: 'string',
            description: 'Короткое описание бизнеса (необязательно)',
          },
          currency: {
            type: 'string',
            description: `Код валюты (ISO 4217), одна из: ${SUPPORTED_CURRENCY_CODES.join(', ')} (необязательно)`,
          },
          templateId: {
            type: 'string',
            description:
              'Готовый набор секций сайта под тип бизнеса — выбери максимально подходящий, а не наугад: "restaurant" для кафе/ресторанов/баров, "agency" для творческих/консалтинговых/digital-студий, "local-business" для остальных локальных сервисов (красота, фитнес, здоровье, ритейл, недвижимость и т.п.). Если бизнес не подходит ни под один из них (например, финтех/крипто/чисто онлайн-продукт) — выбери "blank", не притягивай неподходящий шаблон.',
            enum: [...TEMPLATE_IDS],
          },
        },
        required: ['name', 'category'],
      },
      parseInput: (raw): CreateBusinessInput => {
        if (typeof raw !== 'object' || raw === null) {
          throw new Error('Аргументы должны быть объектом');
        }
        const args = raw as Record<string, unknown>;

        const name = args.name;
        if (typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('name обязателен и должен быть непустой строкой');
        }
        const trimmedName = name.trim();
        if (trimmedName.length > MAX_NAME_LENGTH) {
          throw new Error(`name не может быть длиннее ${MAX_NAME_LENGTH} символов`);
        }

        const category = args.category;
        if (
          typeof category !== 'string' ||
          !CATEGORY_VALUES.includes(category as BusinessCategory)
        ) {
          throw new Error(`category должен быть одним из: ${CATEGORY_VALUES.join(', ')}`);
        }

        let description: string | undefined;
        if (args.description !== undefined) {
          if (typeof args.description !== 'string') {
            throw new Error('description должен быть строкой');
          }
          const trimmedDescription = args.description.trim();
          if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
            throw new Error(`description не может быть длиннее ${MAX_DESCRIPTION_LENGTH} символов`);
          }
          description = trimmedDescription.length > 0 ? trimmedDescription : undefined;
        }

        let currency: string | undefined;
        if (args.currency !== undefined) {
          if (
            typeof args.currency !== 'string' ||
            !SUPPORTED_CURRENCY_CODES.includes(args.currency)
          ) {
            throw new Error(
              `currency должен быть одним из: ${SUPPORTED_CURRENCY_CODES.join(', ')}`,
            );
          }
          currency = args.currency;
        }

        // Нестрого, в отличие от name/category/currency выше: templateId —
        // косметическая подсказка для стартового набора блоков, не
        // идентифицирующие данные бизнеса — отсутствующее/невалидное
        // значение молча становится "blank" (= ничего не применяем), а не
        // блокирует создание бизнеса ошибкой валидации.
        const rawTemplateId = args.templateId;
        const templateId =
          typeof rawTemplateId === 'string' &&
          (TEMPLATE_IDS as readonly string[]).includes(rawTemplateId)
            ? (rawTemplateId as TemplateId)
            : 'blank';

        return {
          name: trimmedName,
          category: category as BusinessCategory,
          description,
          currency,
          templateId,
        };
      },
      handler: async (input, ctx: OnboardingToolContext): Promise<CreateBusinessOutput> => {
        const business = await this.businessesService.create(ctx.actorId, {
          name: input.name,
          category: input.category,
          description: input.description,
          currency: input.currency,
        });
        return {
          businessId: business.id,
          slug: business.slug,
          name: business.name,
          templateId: input.templateId,
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}

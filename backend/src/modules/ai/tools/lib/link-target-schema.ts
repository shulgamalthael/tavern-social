import { isEmail } from 'class-validator';
import { LOOSE_PHONE_PATTERN } from '@/common/lib/phone-validation';

/**
 * Валидатор `LinkTarget` (`frontend/src/entities/website/model/types.ts`) —
 * дискриминированный union с 7 вариантами, нужен для `image.link`/
 * `button.url` в `add-block-schemas.ts` (расширение allowlist на
 * image/button, AI_PLATFORM_ROADMAP.md §9.6/§16 — согласовано с
 * пользователем реализовать сразу широкий v1, включая `addToCart`/
 * `bookAppointment`, не только "простые" варианты). Чистая функция без
 * Prisma — существование `pageId`/`productId`/`serviceId` проверяется
 * ЗДЕСЬ, но множества допустимых id (`LinkTargetRefs`) должен собрать
 * вызывающий код (`AddBlockTool`/`UpdateBlockPropsTool`) ДО вызова, тем же
 * приёмом, что весь остальной модуль: тул-слой читает существующие данные
 * через существующие сервисы, эта функция только валидирует форму и
 * членство в уже собранном множестве, не делает собственных запросов к БД
 * — остаётся юнит-тестируемой без Postgres/DI, как и `add-block-schemas.ts`.
 */

export type LinkTargetType =
  'external' | 'page' | 'anchor' | 'phone' | 'email' | 'addToCart' | 'bookAppointment';

export const LINK_TARGET_TYPES: readonly LinkTargetType[] = [
  'external',
  'page',
  'anchor',
  'phone',
  'email',
  'addToCart',
  'bookAppointment',
];

export interface LinkTargetRefs {
  /** id страниц текущего документа сайта — для `type: 'page'`. */
  pageIds: ReadonlySet<string>;
  /** id активных товаров бизнеса — для `type: 'addToCart'`. */
  productIds: ReadonlySet<string>;
  /** id услуг бизнеса — для `type: 'bookAppointment'`. */
  serviceIds: ReadonlySet<string>;
}

const MAX_URL_LENGTH = 2000;
const MAX_ANCHOR_LENGTH = 100;

/** Бросает с человекочитаемым сообщением при первом же несоответствии —
 * тот же стиль, что `buildValidatedProps`/`parseRuleCondition` в проекте:
 * AI-инпут untrusted, ошибка должна объяснять, что именно не так. */
export function validateLinkTarget(
  raw: unknown,
  refs: LinkTargetRefs,
  path: string,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`${path} должен быть объектом со полем type`);
  }
  const { type, ...rest } = raw as Record<string, unknown>;
  if (typeof type !== 'string' || !LINK_TARGET_TYPES.includes(type as LinkTargetType)) {
    throw new Error(`${path}.type должен быть одним из: ${LINK_TARGET_TYPES.join(', ')}`);
  }

  switch (type as LinkTargetType) {
    case 'external': {
      const url = rest.url;
      if (typeof url !== 'string' || url.length > MAX_URL_LENGTH) {
        throw new Error(`${path}.url должен быть строкой не длиннее ${MAX_URL_LENGTH} символов`);
      }
      return { type, url };
    }
    case 'page': {
      const pageId = rest.pageId;
      if (typeof pageId !== 'string' || !refs.pageIds.has(pageId)) {
        throw new Error(`${path}.pageId должен ссылаться на существующую страницу этого сайта`);
      }
      return { type, pageId };
    }
    case 'anchor': {
      const anchor = rest.anchor;
      if (
        typeof anchor !== 'string' ||
        anchor.trim().length === 0 ||
        anchor.length > MAX_ANCHOR_LENGTH
      ) {
        throw new Error(`${path}.anchor должен быть непустой строкой`);
      }
      return { type, anchor };
    }
    case 'phone': {
      const phone = rest.phone;
      if (typeof phone !== 'string' || !LOOSE_PHONE_PATTERN.test(phone)) {
        throw new Error(`${path}.phone должен быть похож на номер телефона`);
      }
      return { type, phone };
    }
    case 'email': {
      const email = rest.email;
      if (typeof email !== 'string' || !isEmail(email)) {
        throw new Error(`${path}.email должен быть корректным email`);
      }
      return { type, email };
    }
    case 'addToCart': {
      const productId = rest.productId;
      if (typeof productId !== 'string' || !refs.productIds.has(productId)) {
        throw new Error(`${path}.productId должен ссылаться на существующий товар этого бизнеса`);
      }
      return { type, productId };
    }
    case 'bookAppointment': {
      const serviceId = rest.serviceId;
      if (typeof serviceId !== 'string' || !refs.serviceIds.has(serviceId)) {
        throw new Error(`${path}.serviceId должен ссылаться на существующую услугу этого бизнеса`);
      }
      return { type, serviceId };
    }
  }
}

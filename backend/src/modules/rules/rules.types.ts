import { BadRequestException } from '@nestjs/common';
import type { RuleActionType, RuleTrigger } from '@prisma/client';

/** Один пункт условия — маленький, безопасный, типизированный формат
 * сравнения, НЕ JsonLogic/произвольное выражение (AI_PLATFORM_ROADMAP.md
 * §2.5 рекомендует "JsonLogic-style" как один из вариантов, не обязывает —
 * тащить новую зависимость и интерпретатор произвольных выражений ради
 * одного правила на весь проект было бы той спекулятивной инфраструктурой,
 * от которой в проекте всюду отказываются, см. `frontend/AGENTS.md` §1).
 * `field` — dot-путь в контекст триггера (например, `totalCents` для
 * `order_completed`, см. `RULE_TRIGGER_CONTEXT_FIELDS` ниже). */
export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: number | string | boolean;
}

/** Группа условий — узел с РОВНО одним из `any`/`all`, каждый элемент —
 * снова `RuleConditionNode` (лист ИЛИ вложенная группа), поэтому глубина
 * вложенности не ограничена структурой типа. Добавлено вторым бounded-слайсом
 * AI-5 (первый слайс — §13 в AI_PLATFORM_ROADMAP.md — был сознательно
 * AND-only "один реальный сценарий сначала"); формат листа (`RuleCondition`)
 * не менялся, так что все правила, сохранённые до этого слайса, остаются
 * валидными `RuleConditionNode[]` без миграции данных — плоский массив
 * листьев это и есть AND верхнего уровня, тот же смысл, что раньше. */
export interface RuleConditionGroup {
  any?: RuleConditionNode[];
  all?: RuleConditionNode[];
}

export type RuleConditionNode = RuleCondition | RuleConditionGroup;

/** Небольшой, версионируемый enum действий (§2.5: "small, versioned enum"),
 * не произвольный код — дискриминированное объединение. `send_notification`
 * — первый bounded-слайс AI-5. `add_loyalty_points`/`set_membership_tier` —
 * второй, механика согласована с пользователем перед реализацией: клиент
 * идентифицируется по email (см. `CustomerLoyaltyAccount` в schema.prisma —
 * checkout анонимный, `customerEmail` на заказе/записи — единственный
 * стабильный ключ между визитами), число баллов/название тира задаются
 * прямо в действии правила, не выводятся из суммы заказа — простейший
 * вариант, не требующий отдельно определять курс "валюта → баллы". */
export type RuleAction =
  | { type: 'send_notification' }
  | { type: 'add_loyalty_points'; points: number }
  | { type: 'set_membership_tier'; tier: string };

/** Известные поля контекста для каждого триггера — документирует, что вообще
 * можно сравнивать в условии конкретного правила (используется только в
 * error-сообщении `parseRuleCondition` ниже, не как runtime-схема — контекст
 * передаётся уже готовым объектом из вызывающего кода, см. `RulesService.
 * evaluate`). `customerEmail` не участвует в условиях (email не имеет смысла
 * сравнивать через `gt`/`lt`, а `eq` на конкретный email в правиле — не
 * реальный сценарий), но передаётся в context теми же контроллерами ради
 * `add_loyalty_points`/`set_membership_tier` — см. `RulesService.runActions`. */
export const RULE_TRIGGER_CONTEXT_FIELDS: Record<RuleTrigger, string[]> = {
  order_completed: ['totalCents', 'subtotalCents', 'currency', 'status'],
  appointment_booked: ['priceCents', 'durationMinutes', 'currency', 'status', 'serviceName'],
  form_submitted: ['formType', 'formLabel'],
};

const MAX_LOYALTY_POINTS = 1_000_000;
const MAX_TIER_LENGTH = 40;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CONDITION_OPERATORS: RuleCondition['operator'][] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];

/** Валидирует `Rule.condition` КАК ЕГО ПРИСЛАЛ владелец бизнеса через API —
 * тот же принцип, что `parseInput` у AI-инструментов (`AI_PLATFORM_ROADMAP.md
 * §3`: не доверяем форме JSON-поля только потому, что DTO пропустил его как
 * `unknown[]`). `null`/`undefined` — валидно, означает "условия нет, правило
 * срабатывает всегда". */
export function parseRuleCondition(raw: unknown): RuleConditionNode[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new BadRequestException('condition должен быть массивом или отсутствовать');
  }

  return raw.map((item, index) => parseConditionNode(item, `condition[${index}]`));
}

/** Разбирает один узел — лист (`field`/`operator`/`value`) или группу
 * (РОВНО одно из `any`/`all`, непустой массив вложенных узлов). `path` —
 * человекочитаемый префикс для сообщений об ошибке (например,
 * `condition[0]` или `condition[0].any[1]`), чтобы ошибка в глубоко
 * вложенной группе указывала точное место, а не просто "condition невалиден". */
function parseConditionNode(item: unknown, path: string): RuleConditionNode {
  if (!isPlainObject(item)) {
    throw new BadRequestException(`${path} должен быть объектом`);
  }

  if ('any' in item || 'all' in item) {
    const hasAny = 'any' in item;
    const hasAll = 'all' in item;
    if (hasAny === hasAll) {
      throw new BadRequestException(`${path} должен содержать ровно одно из: any, all`);
    }
    const key = hasAny ? 'any' : 'all';
    const children = item[key];
    if (!Array.isArray(children) || children.length === 0) {
      throw new BadRequestException(`${path}.${key} должен быть непустым массивом`);
    }
    return {
      [key]: children.map((child, index) => parseConditionNode(child, `${path}.${key}[${index}]`)),
    };
  }

  const { field, operator, value } = item;
  if (typeof field !== 'string' || field.length === 0) {
    throw new BadRequestException(`${path}.field должен быть непустой строкой`);
  }
  if (
    typeof operator !== 'string' ||
    !CONDITION_OPERATORS.includes(operator as RuleCondition['operator'])
  ) {
    throw new BadRequestException(
      `${path}.operator должен быть одним из: ${CONDITION_OPERATORS.join(', ')}`,
    );
  }
  if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
    throw new BadRequestException(`${path}.value должен быть числом, строкой или булевым`);
  }
  return { field, operator: operator as RuleCondition['operator'], value };
}

const ACTION_TYPES: RuleActionType[] = [
  'send_notification',
  'add_loyalty_points',
  'set_membership_tier',
];

/** Тот же принцип, что `parseRuleCondition` — валидирует `Rule.actions`
 * как их прислал владелец. Минимум одно действие: правило без действий
 * бессмысленно (никогда ничего не делает), лучше отклонить на записи, чем
 * молча создать бесполезную строку. */
export function parseRuleActions(raw: unknown): RuleAction[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException('actions должен быть непустым массивом');
  }

  return raw.map((item, index) => parseRuleAction(item, index));
}

function parseRuleAction(item: unknown, index: number): RuleAction {
  if (!isPlainObject(item) || typeof item.type !== 'string') {
    throw new BadRequestException(`actions[${index}] должен быть объектом с полем type`);
  }
  if (!ACTION_TYPES.includes(item.type as RuleActionType)) {
    throw new BadRequestException(
      `actions[${index}].type должен быть одним из: ${ACTION_TYPES.join(', ')}`,
    );
  }

  if (item.type === 'add_loyalty_points') {
    const { points } = item;
    if (
      typeof points !== 'number' ||
      !Number.isInteger(points) ||
      points < 1 ||
      points > MAX_LOYALTY_POINTS
    ) {
      throw new BadRequestException(
        `actions[${index}].points должен быть целым числом от 1 до ${MAX_LOYALTY_POINTS}`,
      );
    }
    return { type: 'add_loyalty_points', points };
  }

  if (item.type === 'set_membership_tier') {
    const { tier } = item;
    if (typeof tier !== 'string' || tier.trim().length === 0 || tier.length > MAX_TIER_LENGTH) {
      throw new BadRequestException(
        `actions[${index}].tier должен быть непустой строкой не длиннее ${MAX_TIER_LENGTH} символов`,
      );
    }
    return { type: 'set_membership_tier', tier: tier.trim() };
  }

  return { type: 'send_notification' };
}

export interface RuleDto {
  id: string;
  businessId: string;
  name: string;
  trigger: RuleTrigger;
  condition: RuleConditionNode[] | null;
  actions: RuleAction[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Счёт лояльности одного покупателя — владельцу бизнеса, тот же "лёгкий
 * DTO без лишних полей" принцип, что у `BusinessNotificationDto`. */
export interface CustomerLoyaltyAccountDto {
  id: string;
  email: string;
  points: number;
  tier: string | null;
  updatedAt: string;
}

export interface RuleExecutionLogDto {
  id: string;
  ruleId: string;
  trigger: RuleTrigger;
  matched: boolean;
  actionsRun: RuleAction[] | null;
  error: string | null;
  createdAt: string;
}

/** Короткое человекочитаемое описание сработавшего события — сохраняется в
 * `Notification.summary` (AI_PLATFORM_ROADMAP.md §15.4) при выполнении
 * `send_notification`. Чистая функция (без Prisma/NestJS), тестируется без
 * Postgres — тот же приём, что `rule-condition.lib.ts`. Намеренно не
 * пытается быть локале-точным денежным форматтером (в отличие от frontend's
 * `formatMoney`) — это короткая строка для уведомления, не витрина цены. */
export function buildRuleSummary(trigger: RuleTrigger, context: Record<string, unknown>): string {
  switch (trigger) {
    case 'order_completed': {
      const amount = formatCentsRough(context.totalCents, context.currency);
      return amount ? `Новый заказ на ${amount}` : 'Новый заказ';
    }
    case 'appointment_booked': {
      const service = typeof context.serviceName === 'string' ? context.serviceName : null;
      const amount = formatCentsRough(context.priceCents, context.currency);
      if (service && amount) return `Новая запись: ${service} (${amount})`;
      if (service) return `Новая запись: ${service}`;
      return 'Новая запись';
    }
    case 'form_submitted': {
      const label = typeof context.formLabel === 'string' ? context.formLabel : null;
      return label ? `Новая заявка: ${label}` : 'Новая заявка';
    }
  }
}

function formatCentsRough(cents: unknown, currency: unknown): string | null {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return null;
  const amount = (cents / 100).toFixed(2);
  return typeof currency === 'string' ? `${amount} ${currency}` : amount;
}

export type RuleTrigger = 'order_completed' | 'appointment_booked' | 'form_submitted';

export type RuleConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

/** Лист условия — то же самое, что backend's `RuleCondition`
 * (`backend/src/modules/rules/rules.types.ts`), две независимые копии одного
 * контракта, тот же приём, что у `entities/website`'s зеркала
 * `ChatResult`/`ToolExecutionSummary`. */
export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: number | string | boolean;
}

/** Группа `{ any: [...] }`/`{ all: [...] }` — backend поддерживает
 * произвольную вложенность (AI_PLATFORM_ROADMAP.md §15.2), но эта форма
 * сознательно строит только ПЛОСКИЙ список листьев с неявным AND верхнего
 * уровня (тот же "один реальный сценарий сначала" принцип, что уже применён
 * в проекте — например, `set_style`'s AI-инструмент не выставляет
 * "Advanced"-режим независимых отступов через чат). Тип экспортирован для
 * того, чтобы `RuleDto.condition` мог отражать то, что реально может прийти
 * с backend (в т.ч. правило, созданное не через эту форму), даже если сама
 * форма его не редактирует. */
export interface RuleConditionGroup {
  any?: RuleConditionNode[];
  all?: RuleConditionNode[];
}

export type RuleConditionNode = RuleCondition | RuleConditionGroup;

/** Зеркало backend's `RuleAction` (`rules.types.ts`) — `add_loyalty_points`/
 * `set_membership_tier` начисляют/выставляют лояльность покупателю,
 * идентифицированному по email на заказе/записи (см. backend's
 * `CustomerLoyaltyAccount`'s комментарий в schema.prisma). */
export type RuleAction =
  | { type: 'send_notification' }
  | { type: 'add_loyalty_points'; points: number }
  | { type: 'set_membership_tier'; tier: string };

export const RULE_ACTION_TYPE_LABELS: Record<RuleAction['type'], string> = {
  send_notification: 'Уведомить владельца',
  add_loyalty_points: 'Начислить баллы',
  set_membership_tier: 'Установить статус',
};

/** Счёт лояльности одного покупателя — зеркало backend's
 * `CustomerLoyaltyAccountDto`. */
export interface CustomerLoyaltyAccount {
  id: string;
  email: string;
  points: number;
  tier: string | null;
  updatedAt: string;
}

export interface Rule {
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

export const RULE_TRIGGER_LABELS: Record<RuleTrigger, string> = {
  order_completed: 'Заказ оформлен',
  appointment_booked: 'Запись создана',
  form_submitted: 'Заявка отправлена',
};

export interface RuleTriggerField {
  field: string;
  label: string;
  type: 'number' | 'string';
}

/** Зеркало backend's `RULE_TRIGGER_CONTEXT_FIELDS` (`rules.types.ts`) — какие
 * поля контекста реально доступны для условия каждого триггера, плюс
 * человекочитаемая метка и тип (для выбора инпута — число или текст).
 * Список полей, а не сам контракт валидации: backend по-прежнему
 * единственный источник истины на запись (см. `parseRuleCondition`),
 * это только справочник для конструктора условия в форме. */
export const RULE_TRIGGER_FIELDS: Record<RuleTrigger, RuleTriggerField[]> = {
  order_completed: [
    { field: 'totalCents', label: 'Сумма заказа (в копейках/центах)', type: 'number' },
    { field: 'subtotalCents', label: 'Сумма без скидки', type: 'number' },
    { field: 'currency', label: 'Валюта', type: 'string' },
    { field: 'status', label: 'Статус заказа', type: 'string' },
  ],
  appointment_booked: [
    { field: 'priceCents', label: 'Цена услуги (в копейках/центах)', type: 'number' },
    { field: 'durationMinutes', label: 'Длительность (мин)', type: 'number' },
    { field: 'currency', label: 'Валюта', type: 'string' },
    { field: 'status', label: 'Статус записи', type: 'string' },
    { field: 'serviceName', label: 'Название услуги', type: 'string' },
  ],
  form_submitted: [
    { field: 'formType', label: 'Тип формы', type: 'string' },
    { field: 'formLabel', label: 'Название формы', type: 'string' },
  ],
};

export const RULE_CONDITION_OPERATOR_LABELS: Record<RuleConditionOperator, string> = {
  eq: 'равно',
  neq: 'не равно',
  gt: 'больше',
  gte: 'больше или равно',
  lt: 'меньше',
  lte: 'меньше или равно',
};

/** `gt`/`gte`/`lt`/`lte` осмысленны только для числовых полей — тот же
 * принцип, что и в `rule-condition.lib.ts` (сравнение больше/меньше для
 * нечисловых значений просто не совпадёт, но незачем предлагать это в UI). */
export const NUMERIC_ONLY_OPERATORS: RuleConditionOperator[] = ['gt', 'gte', 'lt', 'lte'];

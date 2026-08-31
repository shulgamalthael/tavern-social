import type { RuleCondition, RuleConditionNode } from './rules.types';

/**
 * Чистая функция — вынесена из `RulesService` тем же приёмом, что
 * `gemini-quota.lib.ts`/`ai-capacity.lib.ts` в AI-модуле: тестируема без
 * Postgres. Верхний уровень — AND (все узлы массива должны совпасть, как и
 * раньше), но каждый узел теперь может быть ЛИБО листом (простое сравнение),
 * ЛИБО группой `{ any: [...] }`/`{ all: [...] }` с произвольной вложенностью
 * (`rules.types.ts`'s `RuleConditionNode`) — второй bounded-слайс AI-5,
 * добавляющий OR/nested поверх первого AND-only слайса без изменения формата
 * листа и без миграции уже сохранённых правил (плоский массив листьев —
 * частный случай нового формата с тем же поведением).
 */
export function evaluateConditions(
  conditions: RuleConditionNode[] | null,
  context: Record<string, unknown>,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((node) => evaluateNode(node, context));
}

function evaluateNode(node: RuleConditionNode, context: Record<string, unknown>): boolean {
  if ('any' in node && node.any) {
    return node.any.some((child) => evaluateNode(child, context));
  }
  if ('all' in node && node.all) {
    return node.all.every((child) => evaluateNode(child, context));
  }
  return evaluateLeaf(node as RuleCondition, context);
}

function evaluateLeaf(condition: RuleCondition, context: Record<string, unknown>): boolean {
  const actual = getField(context, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
  }
}

/** Dot-путь в контекст (например, `order.totalCents`) — сегодняшний
 * единственный контекст (`order_completed`) плоский, но dot-путь поддержан
 * с самого начала, чтобы будущий вложенный контекст (например,
 * `appointment_booked` с `{ service: { name }, customer: { email } }`) не
 * потребовал менять формат условия. */
function getField(context: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((accumulator, key) => {
    if (accumulator && typeof accumulator === 'object' && key in accumulator) {
      return (accumulator as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

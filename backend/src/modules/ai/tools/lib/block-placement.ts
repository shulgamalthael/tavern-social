import {
  ALLOWED_CHILDREN,
  BLOCK_SCHEMAS,
  CONTAINER_BLOCK_TYPES,
  isAllowedBlockType,
  type AllowedBlockType,
} from './add-block-schemas';

/**
 * Общая проверка "может ли блок-родитель принять детей" — используется и
 * `AddBlockTool` (один новый блок), и `InsertCustomWidgetTool` (N блоков
 * виджета сразу), раньше независимо копировавшими одну и ту же логику (см.
 * их комментарии на момент code review этой партии) — при правке правила
 * "что считается контейнером"/"кто чьих детей принимает" в одном месте
 * второе молча оставалось со старым поведением. Чистые функции без
 * NestJS/Prisma — тот же приём, что и у `add-block-schemas.ts` (юнит-
 * тестируются напрямую, `block-placement.test.ts`).
 */

/** Бросает, если `parentType` не входит в allowlist ИЛИ не контейнер —
 * TypeScript-assertion, сужает `parentType` до `AllowedBlockType` в месте
 * вызова (дальше можно безопасно индексировать `ALLOWED_CHILDREN` и т.п.
 * без повторной проверки). */
export function assertIsContainer(
  parentId: string,
  parentType: string,
): asserts parentType is AllowedBlockType {
  if (!isAllowedBlockType(parentType) || !CONTAINER_BLOCK_TYPES.has(parentType)) {
    throw new Error(`Блок "${parentId}" не может содержать вложенные блоки (не контейнер)`);
  }
}

export interface DisallowedChild {
  disallowedType: string;
  /** Уже собранная человекочитаемая строка допустимых типов — вызывающий
   * код не обязан заново читать `ALLOWED_CHILDREN` только ради сообщения
   * об ошибке. */
  allowedTypesList: string;
}

/** `null`, если у `parentType` нет ограничения на типы детей (`ALLOWED_
 * CHILDREN[parentType]` не задан — контейнер принимает что угодно) или все
 * `childTypes` допустимы. Иначе — первый недопустимый тип + готовый список
 * допустимых для сообщения об ошибке. Вызывающий код сам решает точную
 * формулировку (см. разницу между `AddBlockTool`/`InsertCustomWidgetTool` —
 * второй ещё называет виджет, из которого пришёл блок). */
export function findDisallowedChild(
  parentType: AllowedBlockType,
  childTypes: readonly string[],
): DisallowedChild | null {
  const allowedChildren = ALLOWED_CHILDREN[parentType];
  if (!allowedChildren) return null;

  const disallowedType = childTypes.find(
    (type) => !isAllowedBlockType(type) || !allowedChildren.has(type),
  );
  if (!disallowedType) return null;

  return { disallowedType, allowedTypesList: [...allowedChildren].join(', ') };
}

/** Капабилити, которые требуют `blockTypes`, но которых НЕТ у бизнеса —
 * пустой массив, если все капабилити уже включены (или ни один тип их не
 * требует). Дедуплицирует через `Set` — виджет с двумя `productgrid`
 * должен назвать `commerce` один раз, не дважды. */
export function findMissingCapabilities(
  blockTypes: readonly string[],
  businessCapabilities: readonly string[],
): string[] {
  const required = new Set<string>();
  for (const type of blockTypes) {
    if (!isAllowedBlockType(type)) continue;
    const capability = BLOCK_SCHEMAS[type].capability;
    if (capability) required.add(capability);
  }
  return [...required].filter((capability) => !businessCapabilities.includes(capability));
}

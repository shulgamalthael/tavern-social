/** Возвращает НОВЫЙ массив с одним изменённым полем одного элемента —
 * общий помощник для инлайн-редактирования текста внутри карточек списков
 * (`services`/`team`/`cards` и т. п.): рендерер блока не хранит элементы
 * поштучно в своём состоянии, поэтому любое изменение поля одного элемента
 * оборачивается в целый новый `items` и уходит через `onEditProp('items',
 * next)`, как единое обновление пропа (см. `onEditItem` в `Repeatable
 * IconCards`/`RepeatablePeopleCards`/`RepeatableSimpleCards`). Не мутирует
 * исходный массив/объект — `updateBlockProps` в сторе полагается на новую
 * ссылку, чтобы заметить изменение. */
export function patchListItem<T extends object>(
  items: T[],
  index: number,
  field: keyof T,
  value: unknown,
): T[] {
  return items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
}

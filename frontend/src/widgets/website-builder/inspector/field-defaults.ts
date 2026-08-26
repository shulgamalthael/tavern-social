import { EMPTY_LINK_TARGET, type DataSourceValue, type FieldSchema } from '@/entities/website';

/** Значение «с нуля» для поля данной схемы — используется и как fallback
 * при чтении/записи responsive-полей (`readResponsiveProp`/
 * `writeResponsiveProp` в `entities/website/model/registry.ts`, когда в
 * `props` вообще ничего нет), и как стартовое значение нового элемента
 * `list`-поля (см. `ListField.tsx`, кнопка «Добавить»). */
export function defaultValueForField(field: FieldSchema): unknown {
  switch (field.control) {
    case 'text':
    case 'textarea':
    case 'richtext':
    case 'url':
      return '';
    case 'number':
      return field.min ?? 0;
    case 'select':
      return field.options[0]?.value ?? '';
    case 'color':
      return '#2563eb';
    case 'toggle':
      return false;
    case 'image':
      return null;
    case 'link':
      return EMPTY_LINK_TARGET;
    case 'dataSource':
      return { limit: 6, sort: 'newest' } satisfies DataSourceValue;
    case 'list':
      return [];
  }
}

/** Пустой элемент для `list`-поля — плоский объект из дефолтов каждого его
 * `itemFields` (см. `FieldSchema` с `control: 'list'` в `registry.ts`). */
export function defaultListItem(itemFields: FieldSchema[]): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const itemField of itemFields) {
    item[itemField.key] = defaultValueForField(itemField);
  }
  return item;
}

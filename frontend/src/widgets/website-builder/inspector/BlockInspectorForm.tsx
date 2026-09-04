'use client';

import {
  getBlockDefinition,
  readResponsiveProp,
  writeResponsiveProp,
  useWebsiteBuilderStore,
  type FieldSchema,
  type WebsiteBlock,
} from '@/entities/website';
import { PaletteIcon } from '@/shared/ui/icons';
import { defaultValueForField } from './field-defaults';
import { FieldGroup } from './FieldGroup';
import { LayoutSection } from './LayoutSection';
import styles from './BlockInspectorForm.module.scss';

export interface BlockInspectorFormProps {
  block: WebsiteBlock;
  businessId: string;
}

/** Поля, которым тесно в узкой колонке десктопного грида (текстовые блоки,
 * картинка, повторяемый список) — растягиваются на всю ширину (см.
 * `slot--wide` в `FieldGroup.module.scss`), остальные (текст/число/выбор/
 * цвет/переключатель/ссылка) — короткие, им достаточно одной ячейки сетки.
 * На телефоне/планшете `FieldGroup` не рисует сетку вообще (дропдаун +
 * один контрол за раз), поэтому там это различие не используется. */
const WIDE_CONTROLS = new Set<FieldSchema['control']>(['textarea', 'richtext', 'image', 'list']);

/**
 * Форма настройки выбранного блока — поля из `definition.fields` (см.
 * `entities/website/model/registry.ts`) плюс общая секция «Отступы и фон»
 * (`LayoutSection.tsx`) внизу. Для `field.responsive` полей значение читает/
 * пишет через `readResponsiveProp`/`writeResponsiveProp` относительно
 * активного вьюпорта канваса (`store.viewport`) — то же самое поле формы на
 * desktop/tablet/mobile показывает и правит РАЗНЫЕ значения одного и того
 * же `props[key]`, без отдельной вкладки на брейкпоинт.
 */
export function BlockInspectorForm({ block, businessId }: BlockInspectorFormProps) {
  const viewport = useWebsiteBuilderStore((state) => state.viewport);
  const pages = useWebsiteBuilderStore((state) => state.document?.pages ?? []);
  const updateBlockProps = useWebsiteBuilderStore((state) => state.updateBlockProps);
  const updateBlockStyle = useWebsiteBuilderStore((state) => state.updateBlockStyle);

  const definition = getBlockDefinition(block.type);
  if (!definition) return null;

  const Icon = definition.icon;

  return (
    <div className={styles.form}>
      <div className={styles.header}>
        <span className={styles.header__icon}>
          <Icon />
        </span>
        <div>
          <p className={styles.header__label}>{definition.label}</p>
          <p className={styles.header__description}>{definition.description}</p>
        </div>
      </div>

      {definition.fields.length > 0 && (
        <div className={styles.fields}>
          <FieldGroup
            businessId={businessId}
            wideControls={WIDE_CONTROLS}
            pages={pages}
            items={definition.fields.map((field) => {
              const rawValue = block.props[field.key];
              const fallback = defaultValueForField(field);
              const value = field.responsive
                ? readResponsiveProp(rawValue, viewport, fallback)
                : rawValue;

              return {
                field,
                value,
                onChange: (next: unknown) => {
                  const nextValue = field.responsive
                    ? writeResponsiveProp(rawValue, viewport, next, fallback)
                    : next;
                  updateBlockProps(block.id, { [field.key]: nextValue });
                },
              };
            })}
          />
        </div>
      )}

      {/* Разделитель перед «Раскладкой» — без него секция начиналась сразу
       * после полей самого блока, без всякой подписи: читалась как случайно
       * приклеенная снизу вторая форма, а не как осмысленно второй раздел
       * той же панели. */}
      <div className={styles.sectionHeading}>
        <PaletteIcon className={styles['sectionHeading__icon']} />
        Оформление и раскладка
      </div>

      <LayoutSection
        style={block.style}
        businessId={businessId}
        isContainer={definition.isContainer}
        onChange={(patch) => updateBlockStyle(block.id, patch)}
      />
    </div>
  );
}

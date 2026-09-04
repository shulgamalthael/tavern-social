'use client';

import { useId, useMemo, useState } from 'react';
import type {
  DataSourceValue,
  FieldSchema,
  LinkTarget,
  SelectOption,
  WebsitePage,
} from '@/entities/website';
import { useWebsiteBuilderStore } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { DataSourceField } from './DataSourceField';
import { ImageField } from './ImageField';
import { LinkField } from './LinkField';
import { ListField } from './ListField';
import styles from './FieldControl.module.scss';

export interface FieldControlProps {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  businessId: string;
  /** Скрывает подпись над контролом (кроме `toggle` — там подпись рядом с
   * переключателем, а не отдельной строкой) — компактный режим телефона/
   * планшета (`FieldGroup.tsx`) уже показывает название свойства в
   * дропдауне-переключателе прямо над этим контролом, повторять его здесь
   * было бы лишним. */
  hideLabel?: boolean;
  /** Только для `control: 'link'` (см. `LinkField.tsx`) — список страниц
   * документа, чтобы можно было выбрать ссылку на конкретную страницу этого
   * же сайта. Опционален и по умолчанию пуст — большинство полей вообще не
   * `link`, прокидывать список страниц им незачем. */
  pages?: WebsitePage[];
}

/** Значение `<select>` у `control: 'spacing'`, когда выбран числовой px —
 * ни один реальный `SpacingSize`/`INHERIT` (`LayoutSection.tsx`) не может
 * совпасть с этой строкой, так что различить «выбрали пресет» от «выбрали
 * свой px» можно просто сравнением: сам факт `typeof value === 'number'`
 * уже достаточен (см. рендер ниже), эта константа нужна только как значение
 * `<option>`, которое покажет `<select>` в этом состоянии. */
const CUSTOM_SPACING_OPTION = '__custom_px__';

/** `image`/`list`/`link` не сводятся к одному `<input>`, с которым можно
 * связать подпись через `htmlFor`/`id` (см. `ImageField`/`ListField`/
 * `LinkField` — своя составная разметка с несколькими полями сразу),
 * поэтому для них подпись — обычный текст, не `<label>` без пары. */
function hasAssociatedControl(control: FieldSchema['control']): boolean {
  return (
    control !== 'toggle' &&
    control !== 'image' &&
    control !== 'list' &&
    control !== 'link' &&
    control !== 'dataSource'
  );
}

/**
 * Один элемент формы инспектора, выбирает конкретный UI-контрол по
 * `field.control` (см. `FieldSchema` в `entities/website/model/registry.ts`)
 * — единая точка ветвления вместо if/else в каждом месте, где рисуется
 * инспектор (`BlockInspectorForm.tsx`, `LayoutSection.tsx`, и рекурсивно
 * сам себя внутри `ListField.tsx` для полей элемента списка). Ничего не
 * знает про стор — только `value`/`onChange`, куда и как писать решает
 * вызывающий (`props` блока напрямую, `props` с responsive-обёрткой, или
 * `style` блока — см. `BlockInspectorForm.tsx`).
 */
export function FieldControl({
  field,
  value,
  onChange,
  businessId,
  hideLabel,
  pages,
}: FieldControlProps) {
  const fieldId = useId();

  return (
    <div className={styles.field}>
      {field.control !== 'toggle' &&
        !hideLabel &&
        (hasAssociatedControl(field.control) ? (
          <label htmlFor={fieldId} className={styles.field__label}>
            {field.label}
          </label>
        ) : (
          <span className={styles.field__label}>{field.label}</span>
        ))}

      {field.control === 'text' && (
        <input
          id={fieldId}
          type="text"
          className={styles.input}
          placeholder={field.placeholder}
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {(field.control === 'textarea' || field.control === 'richtext') && (
        <textarea
          id={fieldId}
          className={styles.textarea}
          rows={field.control === 'textarea' ? (field.rows ?? 3) : 6}
          placeholder={field.control === 'textarea' ? field.placeholder : undefined}
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.control === 'number' && (
        <div className={styles.numberRow}>
          <input
            id={fieldId}
            type="number"
            className={cn(styles.input, styles['input--inline'])}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={(value as number | undefined) ?? ''}
            onChange={(event) =>
              onChange(event.target.value === '' ? undefined : Number(event.target.value))
            }
          />
          {field.suffix && <span className={styles.suffix}>{field.suffix}</span>}
        </div>
      )}

      {field.control === 'select' && (
        <select
          id={fieldId}
          className={styles.select}
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.control === 'spacing' && (
        <div className={styles.colorRow}>
          <select
            id={fieldId}
            className={styles.select}
            value={typeof value === 'number' ? CUSTOM_SPACING_OPTION : ((value as string) ?? '')}
            onChange={(event) => {
              const next = event.target.value;
              onChange(next === CUSTOM_SPACING_OPTION ? 0 : next);
            }}
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value={CUSTOM_SPACING_OPTION}>Свой (px)</option>
          </select>
          {typeof value === 'number' && (
            <input
              type="number"
              min={0}
              className={cn(styles.input, styles['input--inline'])}
              value={value}
              onChange={(event) =>
                onChange(event.target.value === '' ? 0 : Number(event.target.value))
              }
            />
          )}
        </div>
      )}

      {field.control === 'scale' && (
        <ScaleControl
          fieldId={fieldId}
          options={field.options}
          allowCustomPx={field.allowCustomPx}
          value={value}
          onChange={onChange}
        />
      )}

      {field.control === 'segmented' && (
        <div className={styles.segmented} role="group" aria-label={field.label}>
          {field.options.map((option) => {
            const isActive = (value as string | undefined) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  styles.segmented__item,
                  isActive && styles['segmented__item--active'],
                )}
                aria-pressed={isActive}
                title={option.label}
                onClick={() => onChange(option.value)}
              >
                {option.icon ? (
                  <option.icon />
                ) : option.swatch ? (
                  <span
                    className={styles.segmented__swatch}
                    style={{ background: option.swatch }}
                  />
                ) : (
                  <span className={styles.segmented__text}>{option.label}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {field.control === 'color' && (
        <ColorControl
          fieldId={fieldId}
          label={field.label}
          value={value as string | undefined}
          onChange={onChange}
        />
      )}

      {field.control === 'toggle' && (
        <label className={styles.toggle}>
          <span className={styles.toggle__switch}>
            <input
              type="checkbox"
              className={styles.toggle__input}
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span
              className={cn(
                styles.toggle__track,
                Boolean(value) && styles['toggle__track--checked'],
              )}
            />
          </span>
          <span className={styles.toggle__label}>{field.label}</span>
        </label>
      )}

      {field.control === 'url' && (
        <input
          id={fieldId}
          type="url"
          className={styles.input}
          placeholder="https://…"
          value={(value as string | undefined) ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {field.control === 'image' && (
        <ImageField
          value={(value as string | null | undefined) ?? null}
          onChange={onChange}
          businessId={businessId}
        />
      )}

      {field.control === 'link' && (
        <LinkField
          value={value as LinkTarget | undefined}
          onChange={onChange}
          pages={pages ?? []}
          businessId={businessId}
          actionsEnabled={field.actionsEnabled}
        />
      )}

      {field.control === 'dataSource' && (
        <DataSourceField
          value={value as DataSourceValue}
          onChange={onChange}
          entity={field.entity}
        />
      )}

      {field.control === 'list' && (
        <ListField
          field={field}
          value={(value as Record<string, unknown>[] | undefined) ?? []}
          onChange={onChange}
          businessId={businessId}
          pages={pages}
        />
      )}

      {field.hint && field.control !== 'toggle' && (
        <p className={styles.field__hint}>{field.hint}</p>
      )}
    </div>
  );
}

interface ScaleControlProps {
  fieldId: string;
  options: SelectOption[];
  allowCustomPx?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Слайдер по индексу пресета (`control: 'scale'`, см. `registry.ts`) —
 * ползунок ходит по позициям `options`, не по значению напрямую, поэтому
 * шаг всегда «на один осмысленный пресет», независимо от того, что это за
 * шкала (именованные строки или px). `allowCustomPx` добавляет крайний шаг
 * «Свой», раскрывающий числовой инпут — тот же случай, что раньше решал
 * `control: 'spacing'` (см. `CUSTOM_SPACING_OPTION` выше), просто под
 * слайдером вместо `select`. */
function ScaleControl({ fieldId, options, allowCustomPx, value, onChange }: ScaleControlProps) {
  const isCustom = Boolean(allowCustomPx) && typeof value === 'number';
  const maxIndex = options.length - 1 + (allowCustomPx ? 1 : 0);
  const presetIndex = options.findIndex((option) => option.value === value);
  const index = isCustom ? maxIndex : Math.max(presetIndex, 0);
  const currentLabel = isCustom ? 'Свой (px)' : (options[index]?.label ?? '');

  return (
    <div className={styles.scale}>
      <input
        id={fieldId}
        type="range"
        className={styles.scale__range}
        min={0}
        max={maxIndex}
        step={1}
        value={index}
        onChange={(event) => {
          const nextIndex = Number(event.target.value);
          if (allowCustomPx && nextIndex === maxIndex) {
            onChange(0);
          } else {
            onChange(options[nextIndex]?.value);
          }
        }}
      />
      <span className={styles.scale__value}>{currentLabel}</span>

      {isCustom && (
        <input
          type="number"
          min={0}
          className={cn(styles.input, styles['input--inline'])}
          value={value as number}
          onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
        />
      )}
    </div>
  );
}

interface ColorControlProps {
  fieldId: string;
  label: string;
  value: string | undefined;
  onChange: (value: unknown) => void;
}

/** Курируемая палитра — сначала цвета ТЕКУЩЕЙ темы сайта (тот же смысл, что
 * у палитры бренда в топ-конкурентах — Wix/Squarespace всегда показывают
 * цвета бренда первыми в любом цветовом пикере) плюс белый/чёрный, сырой hex
 * (было раньше единственным способом выбрать цвет) — теперь только за
 * отдельной кнопкой «Свой». Курс на «не отбирать возможность» (AI_PLATFORM_
 * ROADMAP.md §45.1 — упрощаем подачу, не мощность): точный подбор остаётся,
 * просто не первым и не единственным вариантом. */
const NEUTRAL_SWATCHES: { hex: string; title: string }[] = [
  { hex: '#ffffff', title: 'Белый' },
  { hex: '#000000', title: 'Чёрный' },
];

function ColorControl({ fieldId, label, value, onChange }: ColorControlProps) {
  const themeColors = useWebsiteBuilderStore((state) => state.document?.theme.colors);

  const palette = useMemo(() => {
    const theme = themeColors
      ? [
          { hex: themeColors.primary, title: 'Акцентный' },
          { hex: themeColors.secondary, title: 'Дополнительный' },
          { hex: themeColors.text, title: 'Текст' },
          { hex: themeColors.muted, title: 'Приглушённый' },
          { hex: themeColors.surface, title: 'Карточки' },
          { hex: themeColors.background, title: 'Фон страницы' },
          { hex: themeColors.border, title: 'Границы' },
        ]
      : [];
    return [...theme, ...NEUTRAL_SWATCHES];
  }, [themeColors]);

  const matchesPreset = palette.some(
    (swatch) => swatch.hex.toLowerCase() === (value ?? '').toLowerCase(),
  );
  // Открыт сразу, только если значение реально задано и не совпадает ни с
  // одним пресетом — пустое поле (например, "берётся из темы сайта") не
  // должно тут же показывать подставной цвет в сыром пикере, будто он уже
  // выбран.
  const [customOpen, setCustomOpen] = useState(Boolean(value) && !matchesPreset);

  return (
    <div className={styles.colorControl}>
      <div className={styles['colorControl__swatches']}>
        {palette.map((swatch) => (
          <button
            key={swatch.title}
            type="button"
            className={cn(
              styles['colorControl__swatch'],
              !customOpen &&
                value?.toLowerCase() === swatch.hex.toLowerCase() &&
                styles['colorControl__swatch--active'],
            )}
            style={{ background: swatch.hex }}
            title={swatch.title}
            aria-label={swatch.title}
            onClick={() => {
              setCustomOpen(false);
              onChange(swatch.hex);
            }}
          />
        ))}
        <button
          type="button"
          className={cn(
            styles['colorControl__swatch'],
            styles['colorControl__swatch--custom'],
            customOpen && styles['colorControl__swatch--active'],
          )}
          title="Свой цвет"
          aria-label="Свой цвет"
          onClick={() => setCustomOpen(true)}
        />
      </div>

      {customOpen && (
        <div className={styles.colorRow}>
          <input
            type="color"
            className={styles.colorSwatch}
            aria-label={label}
            value={value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#2563eb'}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            id={fieldId}
            type="text"
            className={cn(styles.input, styles['input--inline'])}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

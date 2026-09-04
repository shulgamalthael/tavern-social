'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import styles from './EditableText.module.scss';

type EditableTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div' | 'footer';

export interface EditableTextProps {
  as?: EditableTag;
  value: string;
  /** Не передан/`editable: false` — рендерится как обычный статический узел,
   * без единого признака интерактивности (тот же итог, что и раньше:
   * публичная страница, `entities/website/ui/BlockRenderer.tsx`, никогда не
   * передаёт `isEditing`, значит и сюда `editable` никогда не долетит
   * `true` — риска утечки редактируемости на живой сайт нет структурно, не
   * только по соглашению). */
  editable?: boolean;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Однострочный (заголовок, подпись автора цитаты) инлайн-редактируемый
 * текст прямо на холсте — клик включает `contentEditable` НА ТОМ ЖЕ узле
 * (тот же тег/классы/инлайн-стили, что и в режиме чтения — визуально ничего
 * не дёргается при входе в редактирование), Enter/blur коммитят, Escape
 * отменяет несохранённый ввод и возвращает прежнее значение. Тот же паттерн
 * подтверждения (локальный черновик → commit по Enter/blur, cancel по
 * Escape), что уже проверен в `widgets/website-builder/ui/PagesPanel.tsx`
 * для инлайн-переименования страницы — просто на `contentEditable`-узле
 * вместо `&lt;input&gt;`, потому что здесь тег должен визуально совпадать с
 * обычным рендером блока (`&lt;h1&gt;`/`&lt;h2&gt;`/…, см. `as`), а не быть
 * отдельной формой поверх.
 *
 * Для форматированного текста (жирный/курсив/ссылка) — `EditableRichText`
 * рядом, не этот компонент: здесь сознательно голый `contentEditable`,
 * заголовок/подпись автора — короткие однострочные поля, которым не нужен
 * Tiptap.
 */
export function EditableText({
  as: Tag = 'span',
  value,
  editable = false,
  onCommit,
  placeholder = 'Нажмите, чтобы написать',
  className,
  style,
}: EditableTextProps) {
  const [isActive, setActive] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Фокус + курсор в конец текста при входе в редактирование — тот же
  // эффект, что даёт `autoFocus` у обычного `&lt;input&gt;` (`PagesPanel.tsx`),
  // руками, потому что `contentEditable`-узлы не поддерживают `autoFocus`.
  useEffect(() => {
    if (!isActive || !ref.current) return;
    const node = ref.current;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isActive]);

  if (!editable) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    );
  }

  function commit() {
    setActive(false);
    const next = ref.current?.textContent ?? '';
    if (next !== value) onCommit?.(next);
  }

  function cancel() {
    if (ref.current) ref.current.textContent = value;
    setActive(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- динамический тег (`as`), общего типа ref для всех intrinsic-элементов в React нет
      ref={ref as any}
      className={cn(
        className,
        styles.editable,
        isActive && styles['editable--active'],
        !value && styles['editable--empty'],
      )}
      style={style}
      contentEditable={isActive}
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      tabIndex={0}
      onClick={() => !isActive && setActive(true)}
      onBlur={isActive ? commit : undefined}
      onKeyDown={
        isActive
          ? onKeyDown
          : (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActive(true);
              }
            }
      }
    >
      {value || placeholder}
    </Tag>
  );
}

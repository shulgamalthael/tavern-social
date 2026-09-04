'use client';

import { useState, type CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { RichTextEditor } from './RichTextEditor';
import styles from './EditableRichText.module.scss';

export interface EditableRichTextProps {
  /** HTML, уже прошедший санитизацию на backend при последнем сохранении
   * (`sanitizeRichBlockText`, `WebsitesService.saveDraft`) — безопасен для
   * `dangerouslySetInnerHTML` здесь по построению, второй раз не
   * санитизируется на клиенте (см. форвард-комментарий в самом санитайзере
   * про то, что клиентский Tiptap-редактор структурно не может произвести
   * ничего за пределами своей схемы марок — проверка на backend остаётся
   * настоящей границей доверия для прямых вызовов API в обход редактора). */
  value: string;
  editable?: boolean;
  onCommit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}

/** `<p></p>` — то, что Tiptap отдаёт для реально пустого документа (не
 * просто пустая строка) — оба варианта считаются «пусто» для плейсхолдера. */
function isEmptyValue(value: string): boolean {
  return value.trim().length === 0 || value.trim() === '<p></p>';
}

/**
 * Форматированный (жирный/курсив/ссылка) инлайн-редактируемый текст — для
 * `text`/`richtext`/`quote` (см. `entities/website/blocks/typography/
 * index.tsx`). В режиме чтения — обычный `dangerouslySetInnerHTML` (тот же
 * приём, что уже применяется к постам, `entities/post`), Tiptap вообще не
 * монтируется, пока блок не открыт на редактирование (`RichTextEditor`
 * рендерится только при `isActive`) — не держим лишний редактор на каждый
 * текстовый блок страницы одновременно.
 *
 * Обёртка ВСЕГДА `&lt;div&gt;`, не настраиваемый тег — `value` уже содержит
 * СВОЙ СОБСТВЕННЫЙ блочный `&lt;p&gt;` (так отдаёт `editor.getHTML()`, Document
 * у Tiptap всегда состоит из узлов Paragraph), обернуть его ещё и в
 * семантический `&lt;p&gt;` снаружи значило бы получить недопустимый
 * `&lt;p&gt;&lt;p&gt;…&lt;/p&gt;&lt;/p&gt;`. Собственный класс `styles.prose` — на ЛЮБОМ из трёх
 * состояний (чтение/выбор для редактирования/сам редактор), чтобы внутренние
 * `&lt;p&gt;` не унаследовали браузерный дефолтный отступ только в режиме
 * редактирования и не разъезжались визуально при переключении.
 */
export function EditableRichText({
  value,
  editable = false,
  onCommit,
  placeholder = 'Нажмите, чтобы написать',
  className,
  style,
}: EditableRichTextProps) {
  const [isActive, setActive] = useState(false);

  if (!editable) {
    return (
      <div
        className={cn(className, styles.prose)}
        style={style}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  if (isActive) {
    return (
      <RichTextEditor
        initialValue={value}
        className={className}
        style={style}
        onCommit={(next) => {
          setActive(false);
          if (next !== value) onCommit?.(next);
        }}
        onCancel={() => setActive(false)}
      />
    );
  }

  const empty = isEmptyValue(value);
  return (
    <div
      className={cn(className, styles.prose, styles.editable, empty && styles['editable--empty'])}
      style={style}
      role="textbox"
      aria-label={placeholder}
      tabIndex={0}
      onClick={() => setActive(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActive(true);
        }
      }}
      dangerouslySetInnerHTML={{ __html: empty ? placeholder : value }}
    />
  );
}

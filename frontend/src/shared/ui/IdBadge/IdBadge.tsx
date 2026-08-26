'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { CheckIcon, CopyIcon } from '@/shared/ui/icons';
import styles from './IdBadge.module.scss';

/** Сколько миллисекунд держим иконку-галочку после успешного копирования,
 * прежде чем вернуть обычную иконку копирования. */
const COPIED_TIMEOUT_MS = 1600;

/** Сколько символов id показываем с начала и с конца при сокращении —
 * uuid v4 (см. `schema.prisma`, `@default(uuid())`) начинается с 8 hex-
 * символов до первого дефиса, этого достаточно, чтобы визуально не путать
 * соседние записи в списке; хвост добавляем для узнаваемости конкретного
 * id, если админ уже видел и запомнил его окончание. */
const ID_PREFIX_LENGTH = 8;
const ID_SUFFIX_LENGTH = 4;

function formatShortId(id: string): string {
  if (id.length <= ID_PREFIX_LENGTH + ID_SUFFIX_LENGTH + 1) return id;
  return `${id.slice(0, ID_PREFIX_LENGTH)}…${id.slice(-ID_SUFFIX_LENGTH)}`;
}

export interface IdBadgeProps {
  id: string;
  /** Какой сущности принадлежит id — «Пользователь», «Запись», «Группа»…
   * Обязателен: бейдж без подписи неотличим от любого другого id на экране,
   * а рядом часто стоят два разных id сразу (например, автор и сама запись
   * в `PostCard`/`AdminPostsPanel`) — без подписи не понять, какой есть какой. */
  label: string;
  className?: string;
}

/**
 * Подписанный id сущности с кнопкой копирования — общий для мест основного
 * сайта, где id нужен только администратору при модерации (лента, профиль,
 * друзья, см. `currentUser.role === 'admin'` у вызывающих компонентов), и
 * для самой админки (`widgets/admin/ui/*Panel.tsx`). На экране показываем
 * сокращённый id (`formatShortId`) — полный uuid визуально не нёс никакой
 * пользы, только загромождал карточку записи; целиком он доступен через
 * `title`-тултип при наведении и один клик копирует его буфер обмена
 * полностью, так что для реальной сверки/вставки обрезка ничего не стоит.
 */
export function IdBadge({ id, label, className }: IdBadgeProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // Буфер обмена недоступен (нет разрешения/не https) — тихо игнорируем,
      // сам id по-прежнему виден и выделяем текстом вручную.
      return;
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), COPIED_TIMEOUT_MS);
  };

  return (
    <span className={cn(styles['id-badge'], className)}>
      <span className={styles['id-badge__label']}>{label}</span>
      <code className={styles['id-badge__value']} title={id}>
        {formatShortId(id)}
      </code>
      <button
        type="button"
        className={cn(styles['id-badge__copy'], copied && styles['id-badge__copy--done'])}
        onClick={() => void onCopy()}
        aria-label={copied ? 'Id скопирован' : `Скопировать id (${label.toLowerCase()})`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  );
}

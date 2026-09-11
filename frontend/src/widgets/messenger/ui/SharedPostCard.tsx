'use client';

import type { SharedPost } from '@/entities/thread';
import { cn } from '@/shared/lib/cn';
import { stripHtmlText } from '@/shared/lib/strip-html-text';
import { Avatar } from '@/shared/ui/Avatar';
import { LockIcon } from '@/shared/ui/icons';
import styles from './SharedPostCard.module.scss';

export interface SharedPostCardProps {
  sharedPost: SharedPost;
  /** Клик по карточке — переход на стену автора (единого экрана «отдельный
   * пост» в приложении нет, см. `UserProfileView`). Не передан — карточка
   * `not_found` (некуда вести) и `restricted` без `onAuthorClick` всё равно
   * останутся некликабельными по умолчанию (кнопка просто ничего не
   * сделает по клику). */
  onAuthorClick?: (userId: string) => void;
}

/**
 * «Переслать пост в чат» — карточка внутри `MessageBubble`, тот же
 * визуальный уровень, что и `bubble__reply-quote`/`bubble__forwarded`, но
 * самостоятельная (не завязана на `.bubble--mine`-инверсию цвета): часто
 * единственное содержимое сообщения, а не вспомогательная цитата.
 *
 * `restricted` — пост существует, но у ЭТОГО зрителя сейчас нет доступа
 * (§103/§104): верхний блок автора показываем как есть (он публичен всегда),
 * контент — нет. Клик по такой карточке всё равно ведёт на профиль автора —
 * там уже готова `LockedState` с кнопкой «Добавить в друзья»/«Запросить
 * подписку», не тупик.
 */
export function SharedPostCard({ sharedPost, onAuthorClick }: SharedPostCardProps) {
  if (sharedPost.status === 'not_found') {
    return <div className={styles.shared__deleted}>Запись удалена</div>;
  }

  if (sharedPost.status === 'restricted') {
    const { author } = sharedPost;
    return (
      <button
        type="button"
        className={cn(styles.shared, styles['shared--restricted'])}
        onClick={() => onAuthorClick?.(author.id)}
      >
        <Avatar initials={author.initials} src={author.avatarUrl} size="sm" />
        <div className={styles['shared__body']}>
          <span className={styles['shared__author']}>{author.name}</span>
          <span className={styles['shared__locked-text']}>
            <LockIcon className={styles['shared__lock-icon']} />
            Приватная запись — доступ ограничён
          </span>
        </div>
      </button>
    );
  }

  const { post } = sharedPost;
  return (
    <button
      type="button"
      className={styles.shared}
      onClick={() => onAuthorClick?.(post.wallOwnerId ?? post.author.id)}
    >
      <div className={styles['shared__head']}>
        <Avatar initials={post.author.initials} src={post.author.avatarUrl} size="sm" />
        <span className={styles['shared__author']}>{post.author.name}</span>
      </div>
      {post.text && <span className={styles['shared__text']}>{stripHtmlText(post.text)}</span>}
      {post.images[0] && (
        // eslint-disable-next-line @next/next/no-img-element -- миниатюра шаренного поста в чате, не подходит под статическую оптимизацию next/image
        <img src={post.images[0]} alt="" className={styles['shared__image']} />
      )}
    </button>
  );
}

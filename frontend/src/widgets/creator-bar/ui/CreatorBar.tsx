'use client';

import Link from 'next/link';
import { SparkleIcon } from '@/shared/ui/icons';
import styles from './CreatorBar.module.scss';

/** `'own'` — на СВОЕЙ странице профиля, показывается только когда
 * `CreatorProfile.status === 'active'` (см. `HomeApp`) — пока личность не
 * подтверждена/отклонена/приостановлена, плашка не рендерится вообще, а не
 * показывает промежуточный статус, поэтому статус-текст здесь не нужен:
 * если плашка видна, она всегда про активного Creator'а. Только бренд-
 * индикатор + кнопка в Creator Studio. `'visitor'` — на странице ЧУЖОГО
 * активного Creator'а, показывается ЛЮБОМУ посетителю: только
 * бренд-индикатор, без кнопки — та имеет смысл только для владельца
 * профиля, не для стороннего посетителя (см. `HomeApp`'s комментарий про
 * то, откуда берётся `variant`). */
export type CreatorBarProps = { variant: 'own' } | { variant: 'visitor' };

/**
 * Полоска-индикатор Creator, третья такая же плашка после `AdminBar`/
 * `BusinessOwnerBar` (`widgets/admin/ui/AdminBar.tsx`,
 * `widgets/business-owner-bar/ui/BusinessOwnerBar.tsx`) — тот же приём и
 * визуально, и по логике видимости для варианта `'own'`: глобальный
 * индикатор СВОЕЙ роли на любой странице сайта (см. `HomeApp`), не только в
 * разделе «профиль». Вариант `'visitor'` — иначе: показывается только на
 * ЧУЖОЙ странице профиля активного Creator'а, любому постороннему
 * посетителю (см. `HomeApp`, откуда берётся `variant`).
 *
 * Встаёт САМОЙ НИЖНЕЙ из трёх плашек (см. `HomeApp`) — `top` считается от
 * суммы высот `AdminBar`+`BusinessOwnerBar` через те же CSS-переменные
 * (`--admin-bar-h`/`--business-bar-h`, см. `page.module.scss`), с фолбэком
 * `0px` на каждую, если её нет. Свой тёмный, почти чёрный тон (не
 * `--tavern-ink` — та уже занята `AdminBar`, не кирпично-красный
 * `BusinessOwnerBar` — все три плашки должны различаться на глаз, даже стоя
 * одна под другой) с тёплым золотистым акцентом — по просьбе владельца
 * ("черный или какой-то его оттенок").
 */
export function CreatorBar(props: CreatorBarProps) {
  const isOwn = props.variant === 'own';

  return (
    <div className={styles['creator-bar']}>
      <div className={styles['creator-bar__inner']}>
        {isOwn ? (
          <Link href="/creator/studio" className={styles['creator-bar__brand']}>
            <SparkleIcon className={styles['creator-bar__brand-icon']} />
            <span className={styles['creator-bar__brand-label']}>Creator</span>
          </Link>
        ) : (
          <span className={styles['creator-bar__brand']}>
            <SparkleIcon className={styles['creator-bar__brand-icon']} />
            <span className={styles['creator-bar__brand-label']}>Creator</span>
          </span>
        )}

        {isOwn && (
          <Link href="/creator/studio" className={styles['creator-bar__cta']}>
            Creator Studio →
          </Link>
        )}
      </div>
    </div>
  );
}

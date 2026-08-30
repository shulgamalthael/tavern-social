'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Business } from '@/entities/business';
import { BriefcaseIcon, ChevronDownIcon, ExternalLinkIcon, GlobeIcon } from '@/shared/ui/icons';
import styles from './BusinessOwnerBar.module.scss';

export interface BusinessOwnerBarProps {
  /** Бизнесы ТЕКУЩЕГО пользователя (владелец), уже загруженные родителем
   * (`home-app.tsx`, `getBusinesses()`) — этот компонент ничего сам не
   * запрашивает, тот же приём разделения данных/представления, что и у
   * `AdminBar` (тот тоже не решает, показываться ли, только рисует то, что
   * ему передали через условный рендер в `HomeApp`). */
  businesses: Business[];
}

/**
 * Полоска-индикатор «вы владелец бизнеса», второй такой же приём после
 * `AdminBar` (`widgets/admin/ui/AdminBar.tsx`) — постоянное напоминание +
 * быстрый доступ к своим сайтам с ЛЮБОЙ страницы соцсети, не только со
 * страницы «Бизнесы». Красный оттенок — сознательно НЕ `--tavern-danger`
 * (это семантика ошибки/удаления в остальном интерфейсе, использовать её
 * тут означало бы путать «вы владелец» с «что-то не так») — отдельный,
 * тёплый кирпично-красный тон, свой только для этой полоски.
 *
 * Встаёт МЕЖДУ `AdminBar` и `Header` (см. `HomeApp`) и наследует тот же
 * механизм стыковки sticky-элементов через CSS-переменные высоты
 * (`--admin-bar-h`/`--business-bar-h`, см. `page.module.scss`): если админ-
 * плашки нет, эта встаёт на самый верх (`top: 0` через фолбэк переменной),
 * если есть — сразу под ней, а обычный `Header` в любом случае съезжает
 * ниже суммы высот обеих плашек, а не только одной.
 */
export function BusinessOwnerBar({ businesses }: BusinessOwnerBarProps) {
  const [isOpen, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div className={styles['business-bar']}>
      <div className={styles['business-bar__inner']}>
        <Link href="/businesses" className={styles['business-bar__brand']}>
          <BriefcaseIcon className={styles['business-bar__brand-icon']} />
          <span className={styles['business-bar__brand-label']}>Владелец бизнеса</span>
        </Link>

        <div className={styles['business-bar__dropdown']} ref={dropdownRef}>
          <button
            type="button"
            className={styles['business-bar__trigger']}
            aria-expanded={isOpen}
            onClick={() => setOpen((open) => !open)}
          >
            Мои сайты
            <ChevronDownIcon
              className={
                isOpen ? styles['business-bar__chevron--open'] : styles['business-bar__chevron']
              }
            />
          </button>

          {isOpen && (
            <div className={styles['business-bar__panel']} role="menu">
              {businesses.map((business) => (
                <Link
                  key={business.id}
                  href={`/business/${business.id}/dashboard`}
                  className={styles['business-bar__panel-item']}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {business.status === 'published' ? (
                    <GlobeIcon className={styles['business-bar__panel-item-icon']} />
                  ) : (
                    <ExternalLinkIcon className={styles['business-bar__panel-item-icon']} />
                  )}
                  <span className={styles['business-bar__panel-item-name']}>{business.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/businesses" className={styles['business-bar__cta']}>
          Все бизнесы →
        </Link>
      </div>
    </div>
  );
}

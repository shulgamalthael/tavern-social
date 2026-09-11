'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { UserProfileBusiness, UserProfileCreatorStatus, UserRole } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
  ShieldIcon,
  SparkleIcon,
} from '@/shared/ui/icons';
import styles from './ProfileBadges.module.scss';

export interface ProfileBadgesProps {
  role: UserRole;
  creatorStatus: UserProfileCreatorStatus | null;
  businesses: UserProfileBusiness[];
  /** Приватная страница (§103) — тот же бейдж-ряд, что и «Админ»/«Creator»/
   * «Владелец бизнеса», виден любому, кто вообще видит эту карточку (то
   * есть у кого уже есть `canViewFullProfile` — см. `UserProfileView`):
   * приватность профиля не секрет от тех, кому и так открыт весь контент,
   * это просто информационная метка. */
  isPrivate: boolean;
}

/** Есть ли хоть одна роль/метка для показа — вынесено отдельной функцией, а
 * не только внутренним ранним `return null` ниже, потому что вызывающий
 * (`ProfileBadgesCard.tsx`) сам оборачивает этот компонент в `Card` и должен
 * знать заранее, рисовать ли карточку вообще — иначе пустая `Card` без
 * содержимого осталась бы на странице голым прямоугольником с паддингом. */
export function hasProfileBadges({
  role,
  creatorStatus,
  businesses,
  isPrivate,
}: ProfileBadgesProps): boolean {
  return role === 'admin' || creatorStatus === 'active' || businesses.length > 0 || isPrivate;
}

/**
 * Строка бейджей в `ProfileHighlightsCard` — «Админ» / «Владелец бизнеса»
 * (с дропдауном сайтов) / «Creator», на СВОЕЙ странице профиля и на ЧУЖОЙ
 * одинаково — те же роли, что глобальные `AdminBar`/`BusinessOwnerBar`/
 * `CreatorBar` (`widgets/admin`, `widgets/business-owner-bar`,
 * `widgets/creator-bar`) показывают на любой странице сайта, только те три
 * плашки привязаны к ТЕКУЩЕМУ пользователю (`useCurrentUser`) и пропадают
 * вне раздела «профиль» — этот компонент вместо этого получает роль ЛЮБОГО
 * `userId` явными пропсами от вызывающего (`ProfileWidget`/
 * `UserProfileView`, см. `ProfileHighlightsCard`), поэтому одинаково
 * работает и для себя, и для чужого профиля. Иконка и цвет каждого бейджа
 * намеренно совпадают с соответствующей плашкой — узнаваемая пара, а не
 * новый визуальный язык.
 *
 * `null`, если у пользователя нет ни одной роли — весь блок не рендерится,
 * а не показывает пустую строку.
 */
export function ProfileBadges({ role, creatorStatus, businesses, isPrivate }: ProfileBadgesProps) {
  const isAdmin = role === 'admin';
  const isCreator = creatorStatus === 'active';
  const hasBusinesses = businesses.length > 0;

  if (!hasProfileBadges({ role, creatorStatus, businesses, isPrivate })) return null;

  return (
    <div className={styles['profile-badges']}>
      {isAdmin && (
        <span className={cn(styles['profile-badges__pill'], styles['profile-badges__pill--admin'])}>
          <ShieldIcon className={styles['profile-badges__icon']} />
          Админ
        </span>
      )}

      {hasBusinesses && <BusinessOwnerBadge businesses={businesses} />}

      {isCreator && (
        <span
          className={cn(styles['profile-badges__pill'], styles['profile-badges__pill--creator'])}
        >
          <SparkleIcon className={styles['profile-badges__icon']} />
          Creator
        </span>
      )}

      {isPrivate && (
        <span
          className={cn(styles['profile-badges__pill'], styles['profile-badges__pill--private'])}
        >
          <LockIcon className={styles['profile-badges__icon']} />
          Приватный профиль
        </span>
      )}
    </div>
  );
}

function BusinessOwnerBadge({ businesses }: { businesses: UserProfileBusiness[] }) {
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
    <div
      className={cn(styles['profile-badges__pill'], styles['profile-badges__pill--business'])}
      ref={dropdownRef}
    >
      <button
        type="button"
        className={styles['profile-badges__trigger']}
        aria-expanded={isOpen}
        onClick={() => setOpen((open) => !open)}
      >
        <BriefcaseIcon
          className={cn(styles['profile-badges__icon'], styles['profile-badges__icon--business'])}
        />
        Владелец бизнеса
        <ChevronDownIcon
          className={
            isOpen ? styles['profile-badges__chevron--open'] : styles['profile-badges__chevron']
          }
        />
      </button>

      {isOpen && (
        <div className={styles['profile-badges__panel']} role="menu">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/site/${business.id}`}
              className={styles['profile-badges__panel-item']}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <GlobeIcon className={styles['profile-badges__panel-item-icon']} />
              <span className={styles['profile-badges__panel-item-name']}>{business.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

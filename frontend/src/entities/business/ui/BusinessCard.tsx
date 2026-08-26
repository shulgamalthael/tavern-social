'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatRelativeTime } from '@/shared/lib/format-relative-time';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { DuplicateIcon, ExternalLinkIcon, GlobeIcon, MoreIcon, TrashIcon } from '@/shared/ui/icons';
import { getBusinessCategoryConfig } from '../config/categories';
import type { Business } from '../model/types';
import styles from './BusinessCard.module.scss';

export interface BusinessCardProps {
  business: Business;
  onOpen: (businessId: string) => void;
  onDuplicate?: (businessId: string) => void;
  onDelete?: (businessId: string) => void;
  isDuplicating?: boolean;
  isDeleting?: boolean;
}

/**
 * Карточка бизнеса на дашборде `/businesses` (см. `widgets/businesses`) —
 * логотип/инициалы, название, категория, статус сайта, когда последний раз
 * правили, и меню быстрых действий. Сама карточка целиком кликабельна
 * (`onOpen`) — «⋯»-меню намеренно останавливает всплытие клика, чтобы клик
 * по «Удалить» не открывал заодно и сам бизнес.
 */
export function BusinessCard({
  business,
  onOpen,
  onDuplicate,
  onDelete,
  isDuplicating,
  isDeleting,
}: BusinessCardProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const category = getBusinessCategoryConfig(business.category);
  const CategoryIcon = category.icon;
  const isPending = isDuplicating || isDeleting;

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isMenuOpen]);

  return (
    <Card as="article" className={styles.card}>
      <button
        type="button"
        className={styles['card__open-trigger']}
        aria-label={`Открыть ${business.name}`}
        onClick={() => onOpen(business.id)}
      />

      <div className={styles.card__head}>
        <Avatar
          initials={business.name.slice(0, 2).toUpperCase()}
          src={business.logoUrl}
          size="lg"
        />
        <div className={styles['card__head-body']}>
          <span className={styles.card__name}>{business.name}</span>
          <span className={styles.card__category}>
            <CategoryIcon />
            {category.label}
          </span>
        </div>

        {(onDuplicate || onDelete) && (
          <div className={styles.card__menu} ref={menuRef}>
            <button
              type="button"
              className={styles['card__menu-trigger']}
              aria-label={`Действия с ${business.name}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              disabled={isPending}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
            >
              <MoreIcon />
            </button>
            {isMenuOpen && (
              <div
                className={styles['card__menu-panel']}
                role="menu"
                aria-label={`Действия с ${business.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                {onDuplicate && (
                  <button
                    type="button"
                    role="menuitem"
                    className={styles['card__menu-item']}
                    onClick={() => {
                      setMenuOpen(false);
                      onDuplicate(business.id);
                    }}
                  >
                    <DuplicateIcon />
                    Дублировать
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(styles['card__menu-item'], styles['card__menu-item--danger'])}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(business.id);
                    }}
                  >
                    <TrashIcon />
                    Удалить
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {business.description && <p className={styles.card__description}>{business.description}</p>}

      <div className={styles.card__meta}>
        <span
          className={cn(
            styles['card__status'],
            business.status === 'published' && styles['card__status--published'],
          )}
        >
          {business.status === 'published' ? <GlobeIcon /> : <ExternalLinkIcon />}
          {business.status === 'published' ? 'Опубликован' : 'Черновик'}
        </span>
        <span className={styles['card__updated']}>
          Правили {formatRelativeTime(business.updatedAt)}
        </span>
      </div>

      <Button
        variant="outline"
        fullWidth
        className={styles['card__cta']}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(business.id);
        }}
      >
        {business.status === 'published' ? 'Открыть сайт' : 'Продолжить редактирование'}
      </Button>
    </Card>
  );
}

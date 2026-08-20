'use client';

import { useState } from 'react';
import { useNavigationStore } from '@/features/section-navigation';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useGlobalSearch } from '../model/use-global-search';
import type { SearchResult } from '../model/types';
import styles from './SearchDropdown.module.scss';

export interface SearchDropdownProps {
  query: string;
  /** Закрыть выпадающий список — вызывается после перехода в раздел. */
  onNavigate: () => void;
}

type ExpandedKey = string | null;

function isEmptyResult(data: SearchResult): boolean {
  return data.users.length === 0 && data.groups.length === 0 && data.communities.length === 0;
}

export function SearchDropdown({ query, onNavigate }: SearchDropdownProps) {
  const { status, data, error } = useGlobalSearch(query);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const [expanded, setExpanded] = useState<ExpandedKey>(null);

  if (status === 'idle') return null;

  const toggle = (key: string) => setExpanded((current) => (current === key ? null : key));

  return (
    <ScrollArea
      className={styles.dropdown}
      viewportClassName={styles['dropdown__viewport']}
      role="listbox"
    >
      {status === 'loading' && <Loader label="Ищем…" className={styles['dropdown__loader']} />}

      {status === 'error' && <ErrorState message={error} className={styles['dropdown__state']} />}

      {status === 'success' && data && isEmptyResult(data) && (
        <EmptyState
          className={styles['dropdown__state']}
          title="Ничего не найдено"
          description="Попробуйте другой запрос."
        />
      )}

      {status === 'success' && data && !isEmptyResult(data) && (
        <>
          {data.users.length > 0 && (
            <section className={styles['dropdown__group']}>
              <h3 className={styles['dropdown__group-title']}>Люди</h3>
              {data.users.map((user) => (
                <div key={`user:${user.id}`} className={styles['dropdown__row']}>
                  <button
                    type="button"
                    className={styles['dropdown__row-button']}
                    onClick={() => {
                      goToUserProfile(user.id);
                      onNavigate();
                    }}
                  >
                    <Avatar initials={user.initials} size="sm" />
                    <span className={styles['dropdown__row-body']}>
                      <span className={styles['dropdown__row-title']}>{user.name}</span>
                      <span className={styles['dropdown__row-subtitle']}>
                        {user.tagline || 'пока без подписи'}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </section>
          )}

          {data.communities.length > 0 && (
            <section className={styles['dropdown__group']}>
              <h3 className={styles['dropdown__group-title']}>Сообщества</h3>
              {data.communities.map((community) => {
                const key = `community:${community.id}`;
                return (
                  <div key={key} className={styles['dropdown__row']}>
                    <button
                      type="button"
                      className={styles['dropdown__row-button']}
                      aria-expanded={expanded === key}
                      onClick={() => toggle(key)}
                    >
                      <span className={styles['dropdown__row-body']}>
                        <span className={styles['dropdown__row-title']}>{community.name}</span>
                        <span className={styles['dropdown__row-subtitle']}>
                          {community.members}
                          {community.isJoined ? ' · вы участник' : ''}
                        </span>
                      </span>
                    </button>
                    {expanded === key && (
                      <div className={styles['dropdown__details']}>
                        <p>{community.about}</p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            goToSection('communities');
                            onNavigate();
                          }}
                        >
                          Перейти к сообществам
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {data.groups.length > 0 && (
            <section className={styles['dropdown__group']}>
              <h3 className={styles['dropdown__group-title']}>Группы</h3>
              {data.groups.map((group) => {
                const key = `group:${group.id}`;
                return (
                  <div key={key} className={styles['dropdown__row']}>
                    <button
                      type="button"
                      className={styles['dropdown__row-button']}
                      aria-expanded={expanded === key}
                      onClick={() => toggle(key)}
                    >
                      <span className={styles['dropdown__row-mark']} aria-hidden="true">
                        {group.mark}
                      </span>
                      <span className={styles['dropdown__row-body']}>
                        <span className={styles['dropdown__row-title']}>{group.name}</span>
                        <span className={styles['dropdown__row-subtitle']}>{group.meta}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </ScrollArea>
  );
}

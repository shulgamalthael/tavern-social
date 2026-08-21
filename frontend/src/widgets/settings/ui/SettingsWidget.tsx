'use client';

import { useActionState, useEffect, useState } from 'react';
import { getMySettings, type PrivacySettings } from '@/entities/user';
import { useCurrentUser } from '@/entities/user';
import {
  endSession,
  updateProfile,
  updateSettings,
  type UpdateProfileState,
} from '@/features/auth';
import { useNavigationStore } from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { clearPersistedScroll } from '@/shared/lib/use-persisted-scroll';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { Skeleton } from '@/shared/ui/Skeleton';
import { SETTINGS_TOGGLES } from '../config/settings-toggles';
import styles from './SettingsWidget.module.scss';

const INITIAL_STATE: UpdateProfileState = {};

export function SettingsWidget() {
  const { currentUser, applyProfileUpdate } = useCurrentUser();
  const goToSection = useNavigationStore((state) => state.goToSection);
  const [state, formAction, isPending] = useActionState(updateProfile, INITIAL_STATE);
  const { status, data: settings, error, refetch } = useAsyncData(getMySettings);
  // Локальные правки поверх загруженных настроек — так переключение тумблера
  // не требует setState внутри эффекта синхронизации с `settings`.
  const [overrides, setOverrides] = useState<Partial<PrivacySettings>>({});
  const toggles: PrivacySettings | null = settings ? { ...settings, ...overrides } : null;

  useEffect(() => {
    if (state.user) {
      applyProfileUpdate(state.user);
    }
  }, [state.user, applyProfileUpdate]);

  const toggle = (id: keyof PrivacySettings) => {
    if (!toggles) return;
    const next = { ...toggles, [id]: !toggles[id] };
    setOverrides((prev) => ({ ...prev, [id]: next[id] }));
    void updateSettings(next);
  };

  return (
    <SectionContainer narrow>
      <PageHead title="Настройки" />

      <Card>
        <h2 className={styles['settings__card-title']}>Как вас видят в зале</h2>
        <form className={styles['settings__form']} action={formAction}>
          <label className={styles['settings__field']}>
            <span className={styles['settings__field-label']}>Имя</span>
            <input
              name="name"
              defaultValue={currentUser.name}
              required
              minLength={2}
              maxLength={60}
            />
          </label>
          <label className={styles['settings__field']}>
            <span className={styles['settings__field-label']}>Подпись у имени</span>
            <input
              name="tagline"
              defaultValue={currentUser.tagline}
              maxLength={120}
              placeholder="Например: держу стол книжных разговоров"
            />
          </label>
          {state.error && <p className={styles['settings__error']}>{state.error}</p>}
          <Button type="submit" disabled={isPending} className={styles['settings__submit']}>
            {isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className={styles['settings__card-title']}>Тишина и приватность</h2>
        {status === 'loading' &&
          SETTINGS_TOGGLES.map((item) => (
            <div key={item.id} className={styles['settings__toggle-row']}>
              <div>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={13} />
              </div>
              <Skeleton width={42} height={24} radius={12} />
            </div>
          ))}
        {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
        {status === 'success' &&
          toggles &&
          SETTINGS_TOGGLES.map((item) => (
            <div key={item.id} className={styles['settings__toggle-row']}>
              <div>
                <span>{item.label}</span>
                <span className={styles['settings__hint']}>{item.hint}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={toggles[item.id]}
                className={cn(
                  styles['settings__switch'],
                  toggles[item.id] && styles['settings__switch--on'],
                )}
                onClick={() => toggle(item.id)}
              >
                <span className={styles['settings__switch-knob']} />
              </button>
            </div>
          ))}
      </Card>

      <Card>
        <h2 className={styles['settings__card-title']}>Аккаунт</h2>
        <form
          action={endSession}
          onSubmit={() => {
            // Раздел и позиция скролла сохраняются в sessionStorage на всю
            // вкладку (см. `useNavigationStore`/`usePersistedScroll`) — без
            // сброса при выходе следующий вход в этой же вкладке (тем же
            // или другим пользователем) открывался бы там же, где вышел
            // предыдущий, вместо честной ленты по умолчанию.
            goToSection('feed');
            clearPersistedScroll();
          }}
        >
          <Button type="submit" variant="outline">
            Выйти из зала
          </Button>
        </form>
      </Card>
    </SectionContainer>
  );
}

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
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { SETTINGS_TOGGLES } from '../config/settings-toggles';
import styles from './SettingsWidget.module.scss';

const INITIAL_STATE: UpdateProfileState = {};

export function SettingsWidget() {
  const { currentUser, applyProfileUpdate } = useCurrentUser();
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
        {status === 'loading' && <Loader label="Загружаем настройки…" />}
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
        <form action={endSession}>
          <Button type="submit" variant="outline">
            Выйти из зала
          </Button>
        </form>
      </Card>
    </SectionContainer>
  );
}

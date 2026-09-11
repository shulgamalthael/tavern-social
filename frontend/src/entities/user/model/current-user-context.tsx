'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { CurrentUser, EditableProfile } from './types';

/** Тумблеры `PrivacySettings`, отражённые в `CurrentUser` — сейчас только
 * `isPrivate` (см. её комментарий в `types.ts`), но `Pick`, а не одно
 * захардкоженное поле, чтобы добавить следующий тумблер сюда без правки
 * сигнатуры `applySettingsUpdate`. */
export type SettingsPatch = Partial<Pick<CurrentUser, 'isPrivate'>>;

interface CurrentUserContextValue {
  currentUser: CurrentUser;
  /** Применяет изменения профиля к клиентскому состоянию (уже сохранённые на сервере). */
  applyProfileUpdate: (patch: EditableProfile) => void;
  /** То же самое, но для тумблеров `PrivacySettings` (§103) — отдельная
   * функция, а не расширение `applyProfileUpdate`/`EditableProfile`: это
   * разные источники изменений (форма редактирования профиля vs тумблеры
   * на «Настройках»), не одно и то же по смыслу, хоть и патчат один объект. */
  applySettingsUpdate: (patch: SettingsPatch) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

export interface CurrentUserProviderProps {
  /**
   * Значение, прочитанное на сервере из cookie сессии (см. `features/auth`).
   * Приходит пропом из Server Component — так каждый запрос получает свои
   * данные без риска утечки между пользователями через общий модульный store.
   */
  initialUser: CurrentUser;
  children: ReactNode;
}

export function CurrentUserProvider({ initialUser, children }: CurrentUserProviderProps) {
  const [currentUser, setCurrentUser] = useState(initialUser);

  // Стабильная ссылка (функциональная форма setState, без currentUser в
  // замыкании) — иначе каждое обновление профиля пересоздаёт эту функцию,
  // что триггерит любой useEffect с ней в зависимостях и даёт бесконечный
  // цикл рендеров у потребителей (например, форму в SettingsWidget).
  const applyProfileUpdate = useCallback((patch: EditableProfile) => {
    setCurrentUser((prev) => ({ ...prev, ...patch }));
  }, []);

  const applySettingsUpdate = useCallback((patch: SettingsPatch) => {
    setCurrentUser((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<CurrentUserContextValue>(
    () => ({ currentUser, applyProfileUpdate, applySettingsUpdate }),
    [currentUser, applyProfileUpdate, applySettingsUpdate],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error('useCurrentUser должен вызываться внутри <CurrentUserProvider>');
  }
  return context;
}

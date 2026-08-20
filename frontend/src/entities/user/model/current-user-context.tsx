'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { CurrentUser, EditableProfile } from './types';

interface CurrentUserContextValue {
  currentUser: CurrentUser;
  /** Применяет изменения профиля к клиентскому состоянию (уже сохранённые на сервере). */
  applyProfileUpdate: (patch: EditableProfile) => void;
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

  const value = useMemo<CurrentUserContextValue>(
    () => ({ currentUser, applyProfileUpdate }),
    [currentUser, applyProfileUpdate],
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

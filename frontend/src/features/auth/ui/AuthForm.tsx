'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { loginToAccount, registerAccount, type AuthFormState } from '../api/actions';
import styles from './AuthForm.module.scss';

const INITIAL_STATE: AuthFormState = {};

type AuthMode = 'login' | 'register';

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginState, loginAction, isLoginPending] = useActionState(loginToAccount, INITIAL_STATE);
  const [registerState, registerAction, isRegisterPending] = useActionState(
    registerAccount,
    INITIAL_STATE,
  );

  const state = mode === 'login' ? loginState : registerState;
  const isPending = mode === 'login' ? isLoginPending : isRegisterPending;
  const action = mode === 'login' ? loginAction : registerAction;

  return (
    <>
      <div className={styles['form__tabs']} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={cn(styles['form__tab'], mode === 'login' && styles['form__tab--active'])}
          onClick={() => setMode('login')}
        >
          Войти
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={cn(styles['form__tab'], mode === 'register' && styles['form__tab--active'])}
          onClick={() => setMode('register')}
        >
          Создать аккаунт
        </button>
      </div>

      <form className={styles.form} action={action}>
        {mode === 'register' && (
          <label className={styles['form__field']}>
            <span className={styles['form__field-label']}>Как вас называть в зале?</span>
            <input
              name="name"
              placeholder="Например, Аля Кравец"
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
            />
          </label>
        )}

        <label className={styles['form__field']}>
          <span className={styles['form__field-label']}>Email</span>
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label className={styles['form__field']}>
          <span className={styles['form__field-label']}>Пароль</span>
          <input
            name="password"
            type="password"
            placeholder="Не короче 8 символов"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            maxLength={72}
          />
        </label>

        {state.error && <p className={styles['form__error']}>{state.error}</p>}

        <Button type="submit" fullWidth disabled={isPending}>
          {isPending
            ? 'Открываем дверь…'
            : mode === 'login'
              ? 'Войти в зал'
              : 'Создать аккаунт и войти'}
        </Button>
      </form>
    </>
  );
}

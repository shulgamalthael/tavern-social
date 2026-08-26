'use client';

import { useState, type FormEvent } from 'react';
import { connectDomain, type ConnectDomainResult } from '@/entities/domain';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import styles from './ConnectDomainModal.module.scss';

export interface ConnectDomainModalProps {
  businessId: string;
  onConnected: (result: ConnectDomainResult) => void;
  onClose: () => void;
}

/**
 * Первый шаг подключения домена (см. корневой план задачи, «Domain
 * connection UX») — только ввод hostname. DNS-инструкции показываются не
 * здесь, а в самой строке списка после закрытия этой модалки (см.
 * `DomainRow.tsx`, `initialInstructions`) — так они остаются на виду и
 * позже, а не только в момент создания.
 */
export function ConnectDomainModal({ businessId, onConnected, onClose }: ConnectDomainModalProps) {
  const [hostname, setHostname] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hostname.trim()) {
      setError('Введите домен');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await connectDomain(businessId, hostname.trim());
      onConnected(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось подключить домен');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Подключить домен" className={styles.modal}>
      <h2 className={styles.title}>Подключить домен</h2>
      <p className={styles.hint}>Введите домен, которым вы уже владеете, например example.com.</p>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <input
          type="text"
          className={styles.input}
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          placeholder="example.com"
          autoFocus
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Подключаем…' : 'Подключить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

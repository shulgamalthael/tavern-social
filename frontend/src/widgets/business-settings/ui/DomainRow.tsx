'use client';

import { useState } from 'react';
import { getDomainInstructions, type Domain, type DnsInstruction } from '@/entities/domain';
import { cn } from '@/shared/lib/cn';
import { Loader } from '@/shared/ui/Loader';
import { ChevronDownIcon, ChevronUpIcon, GlobeIcon, StarIcon, TrashIcon } from '@/shared/ui/icons';
import styles from './DomainRow.module.scss';

const STATUS_LABEL: Record<Domain['status'], string> = {
  system: 'Системный домен',
  verified: 'Подключён',
  pending: 'Ожидает проверки DNS',
};

export interface DomainRowProps {
  businessId: string;
  domain: Domain;
  isPending: boolean;
  initialInstructions?: DnsInstruction[];
  onVerify: (domainId: string) => void;
  onSetPrimary: (domainId: string) => void;
  onDelete: (domainId: string) => void;
}

/**
 * Одна строка списка доменов — статус, primary-бейдж, действия и (только
 * для неподтверждённого `CUSTOM_DOMAIN`) сворачиваемые DNS-инструкции.
 * Инструкции подгружаются лениво по клику (см. `getDomainInstructions`) —
 * их не нужно держать в памяти для доменов, которые пользователь ни разу
 * не раскрывал.
 */
export function DomainRow({
  businessId,
  domain,
  isPending,
  initialInstructions,
  onVerify,
  onSetPrimary,
  onDelete,
}: DomainRowProps) {
  const [instructions, setInstructions] = useState<DnsInstruction[] | null>(
    initialInstructions ?? null,
  );
  const [isExpanded, setExpanded] = useState(Boolean(initialInstructions?.length));
  const [isLoadingInstructions, setLoadingInstructions] = useState(false);

  const canShowInstructions = domain.type === 'CUSTOM_DOMAIN' && domain.status === 'pending';

  async function toggleInstructions() {
    if (isExpanded) {
      setExpanded(false);
      return;
    }
    if (!instructions) {
      setLoadingInstructions(true);
      try {
        setInstructions(await getDomainInstructions(businessId, domain.id));
      } finally {
        setLoadingInstructions(false);
      }
    }
    setExpanded(true);
  }

  return (
    <li className={styles.row}>
      <div className={styles.row__main}>
        <GlobeIcon className={styles.row__icon} />

        <div className={styles.row__info}>
          <span className={styles.row__hostname}>{domain.hostname}</span>
          <span className={cn(styles.row__status, styles[`row__status--${domain.status}`])}>
            {STATUS_LABEL[domain.status]}
          </span>
        </div>

        {domain.isPrimary && (
          <span className={styles.row__primary}>
            <StarIcon /> Основной
          </span>
        )}

        <div className={styles.row__actions}>
          {canShowInstructions && (
            <button
              type="button"
              className={styles.row__link}
              onClick={() => void toggleInstructions()}
            >
              {isLoadingInstructions ? (
                <Loader label="Загрузка…" />
              ) : (
                <>
                  DNS-инструкции
                  {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </>
              )}
            </button>
          )}

          {domain.type === 'CUSTOM_DOMAIN' && domain.status === 'pending' && (
            <button
              type="button"
              className={styles.row__button}
              disabled={isPending}
              onClick={() => onVerify(domain.id)}
            >
              {isPending ? <Loader label="Проверяем…" /> : 'Проверить'}
            </button>
          )}

          {!domain.isPrimary && domain.isVerified && (
            <button
              type="button"
              className={styles.row__button}
              disabled={isPending}
              onClick={() => onSetPrimary(domain.id)}
            >
              Сделать основным
            </button>
          )}

          {domain.type === 'CUSTOM_DOMAIN' && (
            <button
              type="button"
              className={styles['row__button--danger']}
              aria-label="Удалить домен"
              disabled={isPending}
              onClick={() => onDelete(domain.id)}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {isExpanded && instructions && instructions.length > 0 && (
        <div className={styles.instructions}>
          {instructions.map((instruction) => (
            <div key={`${instruction.type}-${instruction.name}`} className={styles.instruction}>
              <div className={styles['instruction__fields']}>
                <span className={styles['instruction__field']}>
                  <span className={styles['instruction__label']}>Тип</span>
                  <code>{instruction.type}</code>
                </span>
                <span className={styles['instruction__field']}>
                  <span className={styles['instruction__label']}>Имя</span>
                  <code>{instruction.name}</code>
                </span>
                <span className={styles['instruction__field']}>
                  <span className={styles['instruction__label']}>Значение</span>
                  <code>{instruction.value}</code>
                </span>
              </div>
              <p className={styles['instruction__description']}>{instruction.description}</p>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

'use client';

import { useCallback } from 'react';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { getAiActivity } from '../api/get-ai-activity';
import { toolLabel } from '../lib/tool-labels';
import styles from './AiActivityFeed.module.scss';

export interface AiActivityFeedProps {
  businessId: string;
  className?: string;
}

const TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Лента активности AI (AI-3, "activity timeline", mission §39-42, третий
 * пункт группы после стриминга и live-canvas apply — см. §10.7 роадмапа) —
 * последние действия AI по этому бизнесу, читаются из `AuditLog` через
 * `GET /businesses/:businessId/ai/activity`. В отличие от истории диалога в
 * `AiChatPanel` (живёт в `useState`, теряется при перезагрузке), эта лента
 * читается из БД заново при каждом открытии — переживает перезагрузку
 * страницы, но не несёт текста реплик, только факт "что и когда".
 *
 * `useAsyncData` + explicit loading/error/empty (см. `frontend/AGENTS.md`,
 * раздел 4) — данные нужны только этому одному компоненту, не разделяются
 * с другими widgets/features, поэтому без Zustand-стора.
 */
export function AiActivityFeed({ businessId, className }: AiActivityFeedProps) {
  const fetcher = useCallback(() => getAiActivity(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  return (
    <ScrollArea className={cn(styles.feed, className)} viewportClassName={styles.feed__viewport}>
      {status === 'loading' && <Loader label="Загружаю историю…" className={styles.status} />}

      {status === 'error' && (
        <ErrorState message={error} onRetry={refetch} className={styles.status} />
      )}

      {status === 'success' && data && data.length === 0 && (
        <EmptyState
          title="Пока пусто"
          description="Здесь появится история действий AI-ассистента на этом сайте."
          className={styles.status}
        />
      )}

      {status === 'success' && data && data.length > 0 && (
        <ul className={styles.list}>
          {data.map((item) => (
            <li
              key={item.id}
              className={cn(
                styles.item,
                item.status === 'error' && styles['item--error'],
                item.status === 'pending' && styles['item--pending'],
                item.status === 'rejected' && styles['item--rejected'],
              )}
            >
              <span className={styles.item__label}>
                {toolLabel(item.tool)}
                {item.status === 'error' && ' — не удалось'}
                {item.status === 'pending' && ' — ждёт подтверждения'}
                {item.status === 'rejected' && ' — отклонено'}
              </span>
              <time className={styles.item__time} dateTime={item.createdAt}>
                {TIME_FORMATTER.format(new Date(item.createdAt))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}

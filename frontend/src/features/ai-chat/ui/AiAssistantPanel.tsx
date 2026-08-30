'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { AiActivityFeed } from './AiActivityFeed';
import { AiChatPanel, type AiChatPanelProps } from './AiChatPanel';
import styles from './AiAssistantPanel.module.scss';

export type AiAssistantPanelProps = AiChatPanelProps;

type AssistantView = 'chat' | 'activity';

const TABS: Array<{ id: AssistantView; label: string }> = [
  { id: 'chat', label: 'Чат' },
  { id: 'activity', label: 'История' },
];

/**
 * Содержимое плавающего AI-окна билдера (`WebsiteBuilderWidget.tsx`) —
 * маленький переключатель "Чат" / "История" поверх двух самостоятельных
 * view: диалог (`AiChatPanel`, не изменён) и лента прошлых действий AI
 * (`AiActivityFeed`, AI-3, "activity timeline", §10.7 роадмапа). Ровно то
 * же плавающее окно, тот же размер — переключатель добавляет вторую вкладку
 * внутрь уже существующего "мини" окна, а не новую поверхность.
 *
 * `AiActivityFeed` монтируется/размонтируется вместе с переключением вкладки
 * (не остаётся в DOM скрытой, в отличие от `AiChatPanel`, чья история живёт
 * в `useState` и не должна теряться при закрытии окна) — у ленты активности
 * нет своего локального состояния, которое жалко потерять: каждое
 * монтирование просто перечитывает `AuditLog` заново, дешёвый read.
 */
export function AiAssistantPanel(props: AiAssistantPanelProps) {
  const [view, setView] = useState<AssistantView>('chat');

  return (
    <div className={cn(styles.panel, props.className)}>
      <div className={styles.tabs} role="tablist" aria-label="Режим AI-окна">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={cn(styles.tab, view === tab.id && styles['tab--active'])}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.body} role="tabpanel">
        {view === 'chat' ? (
          <AiChatPanel {...props} className={styles.body__view} />
        ) : (
          <AiActivityFeed businessId={props.businessId} className={styles.body__view} />
        )}
      </div>
    </div>
  );
}

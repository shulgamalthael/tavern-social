'use client';

import { useCallback, useState } from 'react';
import {
  deleteRule,
  getRules,
  RULE_TRIGGER_LABELS,
  type Rule,
  type RuleAction,
  type RuleConditionNode,
} from '@/entities/rule';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { cn } from '@/shared/lib/cn';
import { CpuIcon, EditIcon, PlusIcon, TrashIcon } from '@/shared/ui/icons';
import { LoyaltyAccountsSection } from './LoyaltyAccountsSection';
import { RuleFormModal } from './RuleFormModal';
import { RuleNotificationsFeed } from './RuleNotificationsFeed';
// Разметка списка идентична `DiscountsSection`/`ProductsSection` (иконка/
// название/мета/действия в ряд) — переиспользуем тот же модуль стилей, тот
// же приём, что уже применён у `DiscountsSection` (см. её комментарий).
import styles from './ProductsSection.module.scss';
import tabStyles from './RulesSection.module.scss';

export interface RulesSectionProps {
  businessId: string;
}

/** Отображает УЖЕ ВАЛИДНОЕ, но не обязательно построенное этой формой,
 * условие в человекочитаемом виде — включая произвольную вложенность
 * `any`/`all` (AI_PLATFORM_ROADMAP.md §15.2), которую сама форма не строит
 * (см. `RuleFormModal`'s комментарий), но обязана честно показать, если
 * правило было создано иначе (например, напрямую через API). */
function describeCondition(node: RuleConditionNode): string {
  if ('any' in node && node.any) {
    return `(${node.any.map(describeCondition).join(' ИЛИ ')})`;
  }
  if ('all' in node && node.all) {
    return `(${node.all.map(describeCondition).join(' И ')})`;
  }
  if (!('field' in node)) return '';
  const operatorSymbols: Record<string, string> = {
    eq: '=',
    neq: '≠',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤',
  };
  return `${node.field} ${operatorSymbols[node.operator] ?? node.operator} ${node.value}`;
}

/** Человекочитаемое описание действия — так же честно отражает все три
 * реализованных типа, независимо от того, создано ли правило этой формой
 * или напрямую через API (тот же принцип, что `describeCondition`). */
function describeAction(action: RuleAction | undefined): string {
  if (!action) return '';
  if (action.type === 'add_loyalty_points') return `начислить ${action.points} баллов`;
  if (action.type === 'set_membership_tier') return `установить статус «${action.tier}»`;
  return 'уведомить владельца';
}

/**
 * Business Logic Engine v1 (AI_PLATFORM_ROADMAP.md §2.5/§13/§15) —
 * владелец-CRUD правил через ту же секцию Dashboard, что и остальные
 * настройки бизнеса. Не гейтится ни одной капабилити (в отличие от
 * `DiscountsSection`) — тот же принцип, что у `FormsSection`: правила
 * автоматизации не завязаны на `commerce`/`booking` конкретно, доступны
 * любому бизнесу (условие само по себе ссылается на поля конкретного
 * триггера, но создание правила не требует включённой капабилити).
 *
 * Второй под-таб «Уведомления» (§15.4) — история срабатываний правил
 * (`RuleNotificationsFeed`), тот же «Чат»/«История»-приём переключателя, что
 * `AiAssistantPanel` (AI-3, §10.7): один компонент владеет и настройкой
 * автоматизации, и её результатами, не разносится на два разных пункта
 * общего меню Dashboard ради «мини»-масштаба этой фичи.
 */
export function RulesSection({ businessId }: RulesSectionProps) {
  const [view, setView] = useState<'rules' | 'notifications' | 'loyalty'>('rules');

  const fetcher = useCallback(() => getRules(businessId), [businessId]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [editingRule, setEditingRule] = useState<Rule | null | 'new'>(null);
  const [confirmTarget, setConfirmTarget] = useState<Rule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(rule: Rule) {
    setDeletingId(rule.id);
    setDeleteError(null);
    try {
      await deleteRule(businessId, rule.id);
      await refetch();
    } catch {
      setDeleteError('Не удалось удалить правило — попробуйте ещё раз');
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  const tabs = (
    <div className={tabStyles.tabs} role="tablist" aria-label="Автоматизация">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'rules'}
        className={cn(tabStyles.tab, view === 'rules' && tabStyles['tab--active'])}
        onClick={() => setView('rules')}
      >
        Правила
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'notifications'}
        className={cn(tabStyles.tab, view === 'notifications' && tabStyles['tab--active'])}
        onClick={() => setView('notifications')}
      >
        Уведомления
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'loyalty'}
        className={cn(tabStyles.tab, view === 'loyalty' && tabStyles['tab--active'])}
        onClick={() => setView('loyalty')}
      >
        Лояльность
      </button>
    </div>
  );

  if (view === 'notifications') {
    return (
      <>
        {tabs}
        <RuleNotificationsFeed businessId={businessId} />
      </>
    );
  }

  if (view === 'loyalty') {
    return (
      <>
        {tabs}
        <LoyaltyAccountsSection businessId={businessId} />
      </>
    );
  }

  if (status === 'loading') {
    return (
      <>
        {tabs}
        <div className={styles.status}>
          <Loader label="Загружаем правила…" />
        </div>
      </>
    );
  }

  if (status === 'error' || !data) {
    return (
      <>
        {tabs}
        <div className={styles.status}>
          <ErrorState message={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  return (
    <>
      {tabs}
      <div className={styles.header}>
        <p className={styles.hint}>
          Правило автоматически выполняет действие, когда на сайте происходит выбранное событие.
        </p>
        <Button onClick={() => setEditingRule('new')}>
          <PlusIcon />
          Добавить правило
        </Button>
      </div>

      {deleteError && (
        <p className={styles.error} role="alert">
          {deleteError}
        </p>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="Пока нет ни одного правила"
          description="Например: уведомлять о заказе от 1000₴, или о каждой новой заявке с формы."
        />
      ) : (
        <ul className={styles.list}>
          {data.map((rule) => (
            <li key={rule.id} className={styles.row}>
              <div className={styles['row__image']}>
                <CpuIcon />
              </div>
              <div className={styles.row__body}>
                <span className={styles.row__title}>
                  {rule.name}
                  {!rule.isEnabled && <span className={styles.row__hidden}>выключено</span>}
                </span>
                <span className={styles.row__meta}>
                  {RULE_TRIGGER_LABELS[rule.trigger]}
                  {rule.condition && rule.condition.length > 0
                    ? ` · если ${rule.condition.map(describeCondition).join(' И ')}`
                    : ' · всегда'}
                  {` · ${describeAction(rule.actions[0])}`}
                </span>
              </div>
              <button
                type="button"
                className={styles.row__action}
                aria-label={`Редактировать «${rule.name}»`}
                onClick={() => setEditingRule(rule)}
              >
                <EditIcon />
              </button>
              <button
                type="button"
                className={styles['row__action--danger']}
                aria-label={`Удалить «${rule.name}»`}
                disabled={deletingId === rule.id}
                onClick={() => setConfirmTarget(rule)}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editingRule && (
        <RuleFormModal
          businessId={businessId}
          rule={editingRule === 'new' ? null : editingRule}
          onSaved={() => {
            setEditingRule(null);
            void refetch();
          }}
          onClose={() => setEditingRule(null)}
        />
      )}

      {confirmTarget && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmTarget(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить правило «{confirmTarget.name}»? Это необратимо.
            </p>
            <div className={styles.confirmCard__actions}>
              <button
                type="button"
                className={styles.confirmCard__cancel}
                onClick={() => setConfirmTarget(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmCard__delete}
                disabled={deletingId === confirmTarget.id}
                onClick={() => void handleDelete(confirmTarget)}
              >
                {deletingId === confirmTarget.id ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

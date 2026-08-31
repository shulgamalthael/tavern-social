'use client';

import { useState, type FormEvent } from 'react';
import {
  createRule,
  updateRule,
  NUMERIC_ONLY_OPERATORS,
  RULE_ACTION_TYPE_LABELS,
  RULE_CONDITION_OPERATOR_LABELS,
  RULE_TRIGGER_FIELDS,
  RULE_TRIGGER_LABELS,
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RuleConditionNode,
  type RuleConditionOperator,
  type RuleTrigger,
} from '@/entities/rule';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { PlusIcon, TrashIcon } from '@/shared/ui/icons';
import styles from './RuleFormModal.module.scss';

export interface RuleFormModalProps {
  businessId: string;
  /** `null` — создание нового правила, иначе — редактирование существующего. */
  rule: Rule | null;
  onSaved: () => void;
  onClose: () => void;
}

function isLeaf(node: RuleConditionNode): node is RuleCondition {
  return 'field' in node;
}

function makeEmptyLeaf(trigger: RuleTrigger): RuleCondition {
  return { field: RULE_TRIGGER_FIELDS[trigger][0].field, operator: 'eq', value: '' };
}

/**
 * Строит и редактирует правило Business Logic Engine — но намеренно ТОЛЬКО
 * плоский список условий с неявным AND (backend поддерживает произвольную
 * вложенность `any`/`all`, AI_PLATFORM_ROADMAP.md §15.2), тот же "один
 * реальный сценарий сначала" принцип, что уже применён в проекте (например,
 * `set_style`'s AI-инструмент не выставляет "Advanced"-режим независимых
 * отступов через чат — см. её комментарий в `ai/tools/lib/block-style-schema.ts`).
 * Если у редактируемого правила уже есть группа `any`/`all` (создана не этой
 * формой — например, напрямую через API), условие показывается только как
 * пояснение и НЕ перезаписывается при сохранении — см. `hasUnsupportedCondition`
 * ниже.
 *
 * Действие всегда ровно одно — выбирается из трёх реализованных типов
 * (`RuleAction`, см. `entities/rule/model/types.ts`): уведомить владельца,
 * начислить баллы (число — прямо в правиле) или выставить статус (свободная
 * строка — прямо в правиле). Не строит `RuleConditionGroup`-условия (см.
 * `hasUnsupportedCondition` ниже) — тот же принцип не относится к действиям,
 * их всего три и все три ей известны.
 */
export function RuleFormModal({ businessId, rule, onSaved, onClose }: RuleFormModalProps) {
  const [name, setName] = useState(rule?.name ?? '');
  const [trigger, setTrigger] = useState<RuleTrigger>(rule?.trigger ?? 'order_completed');
  const [isEnabled, setIsEnabled] = useState(rule?.isEnabled ?? true);

  const hasUnsupportedCondition = Boolean(rule?.condition?.some((node) => !isLeaf(node)));

  const [leaves, setLeaves] = useState<RuleCondition[]>(() => {
    if (!rule?.condition || hasUnsupportedCondition) return [];
    return rule.condition.filter(isLeaf);
  });

  const existingAction = rule?.actions[0];
  const [actionType, setActionType] = useState<RuleAction['type']>(
    existingAction?.type ?? 'send_notification',
  );
  const [loyaltyPoints, setLoyaltyPoints] = useState(
    existingAction?.type === 'add_loyalty_points' ? String(existingAction.points) : '10',
  );
  const [membershipTier, setMembershipTier] = useState(
    existingAction?.type === 'set_membership_tier' ? existingAction.tier : '',
  );

  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = RULE_TRIGGER_FIELDS[trigger];

  function handleTriggerChange(next: RuleTrigger) {
    setTrigger(next);
    // Поля условия зависят от триггера — условия для старого триггера не
    // обязательно существуют у нового, честнее сбросить, чем оставить
    // ссылки на несуществующие поля (тот же принцип, что у backend's
    // `UpdateRuleDto`, которая вообще не даёт менять триггер у существующего
    // правила — здесь же это создание, старых условий сохранять не нужно).
    setLeaves([]);
  }

  function updateLeaf(index: number, patch: Partial<RuleCondition>) {
    setLeaves((prev) => prev.map((leaf, i) => (i === index ? { ...leaf, ...patch } : leaf)));
  }

  function addLeaf() {
    setLeaves((prev) => [...prev, makeEmptyLeaf(trigger)]);
  }

  function removeLeaf(index: number) {
    setLeaves((prev) => prev.filter((_, i) => i !== index));
  }

  /** `null` — вход невалиден, `setError` уже вызван, сабмит нужно прервать. */
  function buildAction(): RuleAction | null {
    if (actionType === 'add_loyalty_points') {
      const points = Number(loyaltyPoints);
      if (!Number.isInteger(points) || points < 1) {
        setError('Количество баллов должно быть целым числом не меньше 1');
        return null;
      }
      return { type: 'add_loyalty_points', points };
    }
    if (actionType === 'set_membership_tier') {
      if (!membershipTier.trim()) {
        setError('Введите название статуса');
        return null;
      }
      return { type: 'set_membership_tier', tier: membershipTier.trim() };
    }
    return { type: 'send_notification' };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название правила');
      return;
    }

    const action = buildAction();
    if (!action) return;

    const condition: RuleCondition[] = [];
    for (const leaf of leaves) {
      if (String(leaf.value).trim() === '') {
        setError('Заполните значение для каждого условия или удалите пустую строку');
        return;
      }
      const fieldMeta = fields.find((f) => f.field === leaf.field);
      if (fieldMeta?.type === 'number') {
        const parsed = Number(leaf.value);
        if (Number.isNaN(parsed)) {
          setError(`Значение для «${fieldMeta.label}» должно быть числом`);
          return;
        }
        condition.push({ ...leaf, value: parsed });
      } else {
        condition.push(leaf);
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      if (rule) {
        await updateRule(businessId, rule.id, {
          name: name.trim(),
          isEnabled,
          actions: [action],
          ...(hasUnsupportedCondition
            ? {}
            : { condition: condition.length > 0 ? condition : null }),
        });
      } else {
        await createRule(businessId, {
          name: name.trim(),
          trigger,
          condition: condition.length > 0 ? condition : null,
          actions: [action],
          isEnabled,
        });
      }
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить правило');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      label={rule ? 'Редактировать правило' : 'Новое правило'}
      className={styles.modal}
    >
      <h2 className={styles.title}>{rule ? 'Редактировать правило' : 'Новое правило'}</h2>

      <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Уведомление о крупном заказе"
            autoFocus
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Когда</span>
          <select
            className={styles.input}
            value={trigger}
            disabled={Boolean(rule)}
            onChange={(event) => handleTriggerChange(event.target.value as RuleTrigger)}
          >
            {(Object.entries(RULE_TRIGGER_LABELS) as [RuleTrigger, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
          {rule && (
            <span className={styles.hint}>
              Событие нельзя изменить у существующего правила — создайте новое.
            </span>
          )}
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Если (необязательно — иначе срабатывает всегда)</span>

          {hasUnsupportedCondition ? (
            <p className={styles.hint}>
              У этого правила настроено расширенное условие (с «ИЛИ»/вложенностью) — эта форма умеет
              редактировать только простые условия, поэтому оставляет его без изменений.
            </p>
          ) : (
            <div className={styles.conditions}>
              {leaves.map((leaf, index) => {
                const fieldMeta = fields.find((f) => f.field === leaf.field) ?? fields[0];
                const availableOperators = (
                  Object.keys(RULE_CONDITION_OPERATOR_LABELS) as RuleConditionOperator[]
                ).filter(
                  (op) => fieldMeta.type === 'number' || !NUMERIC_ONLY_OPERATORS.includes(op),
                );
                return (
                  <div key={index} className={styles.condition}>
                    <select
                      className={styles.input}
                      value={leaf.field}
                      onChange={(event) =>
                        updateLeaf(index, { field: event.target.value, operator: 'eq' })
                      }
                    >
                      {fields.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select
                      className={styles.input}
                      value={leaf.operator}
                      onChange={(event) =>
                        updateLeaf(index, {
                          operator: event.target.value as RuleConditionOperator,
                        })
                      }
                    >
                      {availableOperators.map((op) => (
                        <option key={op} value={op}>
                          {RULE_CONDITION_OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode={fieldMeta.type === 'number' ? 'decimal' : 'text'}
                      className={styles.input}
                      value={String(leaf.value)}
                      onChange={(event) => updateLeaf(index, { value: event.target.value })}
                    />
                    <button
                      type="button"
                      className={styles.condition__remove}
                      aria-label="Удалить условие"
                      onClick={() => removeLeaf(index)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={addLeaf}>
                <PlusIcon />
                Добавить условие
              </Button>
            </div>
          )}
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Действие</span>
          <select
            className={styles.input}
            value={actionType}
            onChange={(event) => setActionType(event.target.value as RuleAction['type'])}
          >
            {(Object.entries(RULE_ACTION_TYPE_LABELS) as [RuleAction['type'], string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
          {actionType === 'add_loyalty_points' && (
            <input
              type="number"
              min={1}
              step={1}
              className={styles.input}
              value={loyaltyPoints}
              onChange={(event) => setLoyaltyPoints(event.target.value)}
              placeholder="Сколько баллов начислить"
            />
          )}
          {actionType === 'set_membership_tier' && (
            <input
              type="text"
              className={styles.input}
              value={membershipTier}
              onChange={(event) => setMembershipTier(event.target.value)}
              placeholder="Например, gold"
              maxLength={40}
            />
          )}
          {(actionType === 'add_loyalty_points' || actionType === 'set_membership_tier') && (
            <span className={styles.hint}>
              Покупатель определяется по email, указанному при заказе/записи — если email не указан,
              действие тихо пропускается.
            </span>
          )}
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          <span>Правило включено</span>
        </label>

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
            {isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useState } from 'react';
import {
  updateBusiness,
  WEEKDAYS,
  WEEKDAY_LABELS,
  type Business,
  type DayHours,
  type Weekday,
  type WorkingHours,
} from '@/entities/business';
import { Button } from '@/shared/ui/Button';
import styles from './BusinessSettingsWidget.module.scss';

const DEFAULT_DAY_HOURS: DayHours = { open: '09:00', close: '18:00' };

export interface BusinessWorkingHoursSectionProps {
  business: Business;
  onSaved: (business: Business) => void;
}

/**
 * «Часы работы» (Booking, ROADMAP.md §8 Phase 6 continued) — единственное
 * место, где меняется `Business.workingHours`, читается `AppointmentsService`
 * при создании записи (отклоняет время вне часов) и при подсчёте свободных
 * слотов (`BookingModal.tsx`, публичный `GET .../availability`). День без
 * своих часов (галочка снята) значит «закрыт» — если СНЯТЫ ВСЕ галочки,
 * весь `workingHours` отправляется как `null` целиком ("не ограничено", то
 * же поведение, что было единственным до этого поля, см. её комментарий в
 * `entities/business/model/types.ts`), а не семь пустых записей "закрыт
 * каждый день", которые до неразличимости выглядели бы как "бизнес никогда
 * не работает".
 */
export function BusinessWorkingHoursSection({
  business,
  onSaved,
}: BusinessWorkingHoursSectionProps) {
  const [hours, setHours] = useState<WorkingHours>(business.workingHours ?? {});
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: Weekday, enabled: boolean) {
    setHours((current) => {
      if (!enabled) {
        const { [day]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [day]: current[day] ?? DEFAULT_DAY_HOURS };
    });
  }

  function updateDay(day: Weekday, patch: Partial<DayHours>) {
    setHours((current) => ({
      ...current,
      [day]: { ...(current[day] ?? DEFAULT_DAY_HOURS), ...patch },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const hasAnyDay = WEEKDAYS.some((day) => hours[day]);
      const updated = await updateBusiness(business.id, {
        workingHours: hasAnyDay ? hours : null,
      });
      onSaved(updated);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить часы');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles['section__head']}>
        <div>
          <h2 className={styles['section__title']}>Часы работы</h2>
          <p className={styles['section__hint']}>
            Используются для записи на услуги — заявку нельзя оформить вне указанных часов, а на
            странице услуги посетителю показываются только реально свободные слоты. Если ни один
            день не отмечен, записи принимаются в любое время.
          </p>
        </div>
      </div>

      <div className={styles.hoursForm}>
        {WEEKDAYS.map((day) => {
          const dayHours = hours[day];
          return (
            <div key={day} className={styles.hoursRow}>
              <label className={styles.hoursDay}>
                <input
                  type="checkbox"
                  checked={Boolean(dayHours)}
                  onChange={(event) => toggleDay(day, event.target.checked)}
                />
                {WEEKDAY_LABELS[day]}
              </label>

              {dayHours && (
                <div className={styles.hoursTimes}>
                  <input
                    type="time"
                    className={styles.seoInput}
                    value={dayHours.open}
                    onChange={(event) => updateDay(day, { open: event.target.value })}
                  />
                  <span>—</span>
                  <input
                    type="time"
                    className={styles.seoInput}
                    value={dayHours.close}
                    onChange={(event) => updateDay(day, { close: event.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.seoActions}>
          <Button onClick={() => void save()} disabled={isSaving}>
            {isSaving ? 'Сохраняем…' : 'Сохранить часы'}
          </Button>
        </div>
      </div>
    </section>
  );
}

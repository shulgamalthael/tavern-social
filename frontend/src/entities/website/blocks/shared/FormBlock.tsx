'use client';

import { useState, type FormEvent } from 'react';
import { createFormSubmission } from '@/entities/form-submission';
import { SectionHeading } from './SectionHeading';
import styles from './primitives.module.scss';

export interface FormFieldConfig {
  label: string;
  type: 'text' | 'email' | 'textarea';
}

export interface FormBlockProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  fields: FormFieldConfig[];
  submitLabel: string;
  successMessage: string;
  /** Тип блока (`contactform`/`newsletterform`/`simpleform`) — снэпшот
   * `FormSubmission.formType` на backend (см. `blocks/forms/index.tsx`,
   * передаётся рендерером, не настраивается в инспекторе). */
  formType: string;
  businessId: string;
  isEditing?: boolean;
}

/**
 * Общий движок `contactform`/`newsletterform`/`simpleform` (см.
 * `blocks/forms/index.tsx`) — реальная отправка на backend (см.
 * `entities/form-submission`, `PublicSitesController.createFormSubmission`),
 * анонимно, без сессии Таверны, тот же принцип, что и у `CartWidget`/
 * `BookingModal`. Значения полей ключуются по `field.label` (не по
 * стабильному id — у поля его нет, см. `FormFieldConfig`); два поля с
 * одинаковой подписью в одной форме — известный, не решаемый в этом
 * инкременте край (та же "не строить впрок" дисциплина, что и у остальных
 * MVP-сужений в проекте). Скрытое honeypot-поле — простейшая антиспам-мера
 * без внешнего CAPTCHA-вендора (см. ROADMAP.md §3.10): реальный посетитель
 * его не видит и не заполняет, бот, обходящий форму программно, часто
 * заполняет всё подряд. Внутри билдера (`isEditing`) кнопка не отправляет
 * вообще, чтобы не путать «просмотр» с «настоящей отправкой во время
 * редактирования».
 */
export function FormBlock({
  eyebrow,
  heading,
  description,
  fields,
  submitLabel,
  successMessage,
  formType,
  businessId,
  isEditing,
}: FormBlockProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEditing || status === 'submitting') return;

    setStatus('submitting');
    try {
      await createFormSubmission(businessId, {
        formType,
        formLabel: heading || submitLabel,
        data: values,
        honeypot: honeypot || undefined,
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className={styles.block}>
      <SectionHeading eyebrow={eyebrow} heading={heading} description={description} align="left" />
      {status === 'success' ? (
        <p className={styles['form__success']}>{successMessage}</p>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          {fields.map((field, index) => (
            <label key={index} className={styles['form__field']}>
              <span className={styles['form__label']}>{field.label}</span>
              {field.type === 'textarea' ? (
                <textarea
                  className={styles['form__textarea']}
                  rows={4}
                  required
                  value={values[field.label] ?? ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.label]: event.target.value }))
                  }
                />
              ) : (
                <input
                  className={styles['form__input']}
                  type={field.type}
                  required
                  value={values[field.label] ?? ''}
                  onChange={(event) =>
                    setValues((prev) => ({ ...prev, [field.label]: event.target.value }))
                  }
                />
              )}
            </label>
          ))}
          <label className={styles['form__honeypot']} aria-hidden="true">
            <span>Оставьте это поле пустым</span>
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </label>
          {status === 'error' && (
            <p className={styles['form__error']}>Не удалось отправить форму — попробуйте ещё раз</p>
          )}
          <button
            type="submit"
            className={styles['form__submit']}
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Отправляем…' : submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}

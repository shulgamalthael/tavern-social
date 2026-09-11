'use client';

import { useEffect, useState } from 'react';
import { CloseIcon, MailIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { FormBlock, type FormFieldConfig } from '../shared/FormBlock';
import styles from '../shared/primitives.module.scss';

// Три пресета одного и того же движка (`FormBlock`, см. `blocks/shared/
// FormBlock.tsx`) — разные дефолтные поля и подписи, а не три разные
// реализации формы. Каждый регистрируется со своим `makeRenderer(type)`,
// чтобы `FormBlock` знал, какой `formType` отправлять на backend (см.
// `entities/form-submission`, `FormSubmissionsService`).

interface FormProps {
  eyebrow: string;
  heading: string;
  description: string;
  fields: FormFieldConfig[];
  submitLabel: string;
  successMessage: string;
}

const formFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Текст', control: 'textarea', rows: 2 },
  {
    key: 'fields',
    label: 'Поля формы',
    control: 'list',
    itemLabel: 'Поле',
    max: 6,
    itemFields: [
      { key: 'label', label: 'Подпись поля', control: 'text' },
      {
        key: 'type',
        label: 'Тип',
        control: 'select',
        options: [
          { value: 'text', label: 'Короткий текст' },
          { value: 'email', label: 'Email' },
          { value: 'textarea', label: 'Длинный текст' },
        ],
      },
    ],
  },
  { key: 'submitLabel', label: 'Текст кнопки отправки', control: 'text' },
  { key: 'successMessage', label: 'Сообщение после отправки', control: 'text' },
];

function makeRenderer(formType: string) {
  return function FormRenderer({
    props,
    business,
    isEditing,
    onEditProp,
  }: BlockRendererProps<FormProps>) {
    return (
      <FormBlock
        {...props}
        formType={formType}
        businessId={business.businessId}
        isEditing={isEditing}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
    );
  };
}

registerBlock<FormProps>({
  type: 'contactform',
  label: 'Форма обратной связи',
  category: 'forms',
  icon: MailIcon,
  description: 'Имя, email и сообщение',
  defaultProps: {
    eyebrow: '',
    heading: 'Напишите нам',
    description: 'Ответим в течение рабочего дня.',
    fields: [
      { label: 'Имя', type: 'text' },
      { label: 'Email', type: 'email' },
      { label: 'Сообщение', type: 'textarea' },
    ],
    submitLabel: 'Отправить',
    successMessage: 'Спасибо! Мы получили ваше сообщение и скоро ответим.',
  },
  fields: formFields,
  Renderer: makeRenderer('contactform'),
});

registerBlock<FormProps>({
  type: 'newsletterform',
  label: 'Подписка на рассылку',
  category: 'forms',
  icon: MailIcon,
  description: 'Форма из одного email-поля',
  defaultProps: {
    eyebrow: '',
    heading: 'Будьте в курсе новостей',
    description: '',
    fields: [{ label: 'Email', type: 'email' }],
    submitLabel: 'Подписаться',
    successMessage: 'Спасибо за подписку!',
  },
  fields: formFields,
  Renderer: makeRenderer('newsletterform'),
});

registerBlock<FormProps>({
  type: 'simpleform',
  label: 'Произвольная форма',
  category: 'forms',
  icon: MailIcon,
  description: 'Форма с полями на ваш выбор',
  defaultProps: {
    eyebrow: '',
    heading: 'Оставьте заявку',
    description: '',
    fields: [{ label: 'Телефон', type: 'text' }],
    submitLabel: 'Отправить заявку',
    successMessage: 'Заявка отправлена, мы свяжемся с вами.',
  },
  fields: formFields,
  Renderer: makeRenderer('simpleform'),
});

// --- Newsletter popup ------------------------------------------------------
// Тот же движок `FormBlock`, что и три пресета выше (реальная отправка на
// backend, не фиктивная форма) — обёрнутый в тот же паттерн задержки/
// подложки/`--preview`, что и `popupoffer` (`blocks/content/index.tsx`):
// открывается сама через `delaySeconds`, `isEditing` открывает её сразу и
// без фиксированного фона на весь холст (иначе редактирование страницы
// вокруг стало бы невозможным). Отличие от `popupoffer` — там кнопка ведёт
// по произвольной ссылке, здесь внутри настоящая форма с email-полем.

interface NewsletterPopupProps extends FormProps {
  delaySeconds: number;
}

function NewsletterPopupRenderer({
  props,
  business,
  isEditing,
  onEditProp,
}: BlockRendererProps<NewsletterPopupProps>) {
  const [open, setOpen] = useState(() => Boolean(isEditing));
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (isEditing) return;
    const id = setTimeout(() => setOpen(true), Math.max(0, props.delaySeconds) * 1000);
    return () => clearTimeout(id);
  }, [isEditing, props.delaySeconds]);

  if (!open || closed) return null;

  const card = (
    <div
      className={styles['form-popup__card']}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal={!isEditing || undefined}
      aria-label={props.heading}
    >
      <button
        type="button"
        className={styles['form-popup__close']}
        aria-label="Закрыть"
        onClick={() => setClosed(true)}
      >
        <CloseIcon />
      </button>
      <FormBlock
        {...props}
        formType="newsletterpopup"
        businessId={business.businessId}
        isEditing={isEditing}
        onEditEyebrow={(value) => onEditProp?.('eyebrow', value)}
        onEditHeading={(value) => onEditProp?.('heading', value)}
        onEditDescription={(value) => onEditProp?.('description', value)}
      />
    </div>
  );

  if (isEditing) {
    return <div className={styles['form-popup__preview']}>{card}</div>;
  }

  return (
    <div className={styles['form-popup__backdrop']} onClick={() => setClosed(true)}>
      {card}
    </div>
  );
}

registerBlock<NewsletterPopupProps>({
  type: 'newsletterpopup',
  label: 'Всплывающая подписка',
  category: 'forms',
  icon: MailIcon,
  description: 'Модальное окно с формой подписки, появляется через паузу после открытия страницы',
  defaultProps: {
    eyebrow: '',
    heading: 'Не пропустите новости',
    description: 'Подпишитесь и получайте новости первыми.',
    fields: [{ label: 'Email', type: 'email' }],
    submitLabel: 'Подписаться',
    successMessage: 'Спасибо за подписку!',
    delaySeconds: 5,
  },
  fields: [
    ...formFields,
    {
      key: 'delaySeconds',
      label: 'Задержка появления (сек)',
      control: 'number',
      min: 0,
      max: 60,
      hint: 'Через сколько секунд после открытия страницы показать окно',
    },
  ],
  Renderer: NewsletterPopupRenderer,
});

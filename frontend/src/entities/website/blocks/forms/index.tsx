import { MailIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { FormBlock, type FormFieldConfig } from '../shared/FormBlock';

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
  return function FormRenderer({ props, business, isEditing }: BlockRendererProps<FormProps>) {
    return (
      <FormBlock
        {...props}
        formType={formType}
        businessId={business.businessId}
        isEditing={isEditing}
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

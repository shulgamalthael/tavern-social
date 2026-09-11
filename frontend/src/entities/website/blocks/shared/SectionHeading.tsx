import { cn } from '@/shared/lib/cn';
import { EditableText } from '../../ui/EditableText';
import styles from './primitives.module.scss';

export interface SectionHeadingProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  align?: 'left' | 'center';
  /** Инлайн-редактирование прямо на холсте (см. `EditableText`) — каждое
   * поле включается СВОИМ колбэком независимо: блок передаёт только тот
   * `onEdit*`, для которого у него реально есть соответствующий проп (не
   * у каждого блока есть `eyebrow`/`description`, см. вызовы в `blocks/
   * business`/`blocks/content`). Без `editable` компонент ведёт себя как
   * раньше — ни один из трёх колбэков не читается. */
  editable?: boolean;
  onEditEyebrow?: (value: string) => void;
  onEditHeading?: (value: string) => void;
  onEditDescription?: (value: string) => void;
}

/** Эйебрау + заголовок + подпись — общая шапка секции, которую использует
 * добрая половина бизнес-блоков (Hero/About/Services/Team/Testimonials/
 * Pricing/FAQ/Stats и т. д., см. `blocks/business`, `blocks/content`) —
 * заведена один раз здесь, а не копипастой в каждом. */
export function SectionHeading({
  eyebrow,
  heading,
  description,
  align = 'center',
  editable = false,
  onEditEyebrow,
  onEditHeading,
  onEditDescription,
}: SectionHeadingProps) {
  const eyebrowEditable = editable && Boolean(onEditEyebrow);
  const headingEditable = editable && Boolean(onEditHeading);
  const descriptionEditable = editable && Boolean(onEditDescription);

  // Пустая секция без единого редактируемого поля — как и раньше, ничего не
  // рендерим. Если хоть одно поле редактируемо, секция остаётся видимой даже
  // без текста — иначе кликнуть было бы некуда (тот же приём, что у `Quote`,
  // `blocks/typography/index.tsx`, для необязательного `author`).
  if (
    !eyebrow &&
    !heading &&
    !description &&
    !eyebrowEditable &&
    !headingEditable &&
    !descriptionEditable
  ) {
    return null;
  }

  return (
    <div className={cn(styles['heading'], align === 'left' && styles['heading--left'])}>
      {(eyebrow || eyebrowEditable) && (
        <EditableText
          as="span"
          value={eyebrow ?? ''}
          editable={eyebrowEditable}
          onCommit={onEditEyebrow}
          placeholder="Надпись сверху"
          className={styles['heading__eyebrow']}
        />
      )}
      {(heading || headingEditable) && (
        <EditableText
          as="h2"
          value={heading ?? ''}
          editable={headingEditable}
          onCommit={onEditHeading}
          placeholder="Заголовок раздела"
          className={styles['heading__title']}
        />
      )}
      {(description || descriptionEditable) && (
        <EditableText
          as="p"
          value={description ?? ''}
          editable={descriptionEditable}
          onCommit={onEditDescription}
          placeholder="Текст описания"
          className={styles['heading__description']}
        />
      )}
    </div>
  );
}

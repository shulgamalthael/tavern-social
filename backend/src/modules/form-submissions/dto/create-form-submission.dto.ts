import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { FORM_SUBMISSION_TYPES, type FormSubmissionType } from '../form-submissions.types';

/** `data` — намеренно `Record<string, string>` без пофлдьной валидации
 * декоратором (у формы произвольный набор полей, заданный владельцем в
 * Builder — фиксированной схемы нет и быть не может): форму значений
 * проверяет `FormSubmissionsService.assertValidData` вручную (количество
 * полей/длина значений), а не `class-validator` здесь. */
export class CreateFormSubmissionDto {
  @IsIn(FORM_SUBMISSION_TYPES, { message: 'Неизвестный тип формы' })
  formType!: FormSubmissionType;

  @IsString()
  @Length(0, 200)
  formLabel!: string;

  @IsObject()
  data!: Record<string, string>;

  /** Honeypot — скрытое от настоящих посетителей поле (см. `FormBlock.tsx`).
   * Заполнено ботом → запрос принимается (200), но ничего не сохраняется
   * (см. `FormSubmissionsService.createFromRequest`) — так бот не понимает,
   * что его вычислили, и не учится убирать поле в следующий раз. */
  @IsOptional()
  @IsString()
  honeypot?: string;
}

/** Пять пресетов одного движка `FormBlock` на frontend (см. `entities/
 * website/blocks/forms` — три обычные формы, плюс `newsletterpopup`, тот же
 * движок во всплывающем окне) и `herosplitform` (`blocks/business/
 * index.tsx`, тот же `FormBlock` встроенный в главный экран) — не
 * капабилити, форма доступна любому бизнесу без включения
 * `Business.capabilities` (см. комментарий модели `FormSubmission` в
 * schema.prisma). Забытое добавление сюда нового пресета — реальная ошибка
 * этого проекта (найдена вживую Playwright-проверкой партии виджетов №5):
 * `formType` кураторского списка блоков (`add-block-schemas.ts`) и ЭТОТ
 * список — два НЕЗАВИСИМЫХ allowlist'а, обновлять нужно оба. */
export const FORM_SUBMISSION_TYPES = [
  'contactform',
  'newsletterform',
  'simpleform',
  'newsletterpopup',
  'herosplitform',
] as const;
export type FormSubmissionType = (typeof FORM_SUBMISSION_TYPES)[number];

export interface FormSubmissionDto {
  id: string;
  businessId: string;
  formType: string;
  formLabel: string;
  data: Record<string, string>;
  createdAt: string;
}

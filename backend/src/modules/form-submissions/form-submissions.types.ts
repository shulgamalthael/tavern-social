/** Три пресета одного движка `FormBlock` на frontend (см. `entities/website/
 * blocks/forms`) — не капабилити, форма доступна любому бизнесу без
 * включения `Business.capabilities` (см. комментарий модели
 * `FormSubmission` в schema.prisma). */
export const FORM_SUBMISSION_TYPES = ['contactform', 'newsletterform', 'simpleform'] as const;
export type FormSubmissionType = (typeof FORM_SUBMISSION_TYPES)[number];

export interface FormSubmissionDto {
  id: string;
  businessId: string;
  formType: string;
  formLabel: string;
  data: Record<string, string>;
  createdAt: string;
}

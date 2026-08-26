/** Заявка с одной из форм сайта (`contactform`/`newsletterform`/
 * `simpleform`, единый движок `FormBlock` — см. `entities/website/blocks/
 * forms`). Единственная капабилити-независимая сущность в проекте: формы
 * доступны любому бизнесу без включения `Business.capabilities` (см.
 * комментарий модели `FormSubmission` в backend schema.prisma). `formLabel`
 * и ключи `data` — снэпшот на момент отправки (заголовок блока/подписи
 * полей), не связь на живой блок — блоки живут в JSON-документе сайта, а
 * не отдельными строками с ID. */
export interface FormSubmission {
  id: string;
  businessId: string;
  formType: string;
  formLabel: string;
  data: Record<string, string>;
  createdAt: string;
}

import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Тот же формат id, что `isChatAttachmentId` в `common/lib/upload.ts` —
 * продублирован как строка регулярки (не импортирован), т.к. DTO-декораторы
 * `class-validator` не могут переиспользовать функцию-предикат напрямую;
 * `AiService`/`resolveChatAttachmentPath` перепроверяют тем же паттерном
 * как последний рубеж, так что рассинхрон здесь не опасен, только шумит на
 * лишний символ раньше срока. */
const CHAT_ATTACHMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|pdf|zip|txt|doc|docx|xls|xlsx)$/;

export class ChatRequestDto {
  @IsString()
  @MinLength(1, { message: 'Сообщение не может быть пустым' })
  @MaxLength(4000, { message: 'Сообщение слишком длинное' })
  message!: string;

  /** Id вложений, заранее загруженных через `POST .../ai/chat/attachments`
   * (`AiController.uploadAttachment`) — см. `AiService.runToolLoop` про то,
   * как они резолвятся в base64 и передаются модели. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Не больше 5 вложений за раз' })
  @IsString({ each: true })
  @Matches(CHAT_ATTACHMENT_ID_PATTERN, { each: true, message: 'Некорректный id вложения' })
  attachmentIds?: string[];
}

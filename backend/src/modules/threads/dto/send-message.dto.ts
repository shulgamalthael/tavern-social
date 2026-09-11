import { IsOptional, IsString, Length } from 'class-validator';

export class SendMessageDto {
  /** Опционален — сообщение может состоять только из вложения (см.
   * `ThreadsController.sendMessage`, `FilesInterceptor`). «Текст или хотя бы
   * одно вложение» проверяет `ThreadsService.sendMessage`, не DTO — здесь
   * файлы не видны, они приходят отдельным полем формы. */
  @IsOptional()
  @IsString()
  @Length(0, 2000, { message: 'Сообщение должно быть не длиннее 2000 символов' })
  text?: string;

  /** Id сообщения в этом же треде, на которое отвечают — опционален, обычная
   * отправка им не пользуется. Проверка «сообщение правда в этом треде» —
   * в `ThreadsService.sendMessage` (`assertMessageInThread`), не здесь. */
  @IsOptional()
  @IsString()
  replyToId?: string;

  /** «Переслать пост в чат» (§104) — id поста, которым делятся. Проверка
   * «отправитель правда видит этот пост сейчас» — в `ThreadsService.
   * sendMessage` (`PostsService.getShareSummary`), не здесь, тот же приём,
   * что у `replyToId`. */
  @IsOptional()
  @IsString()
  sharedPostId?: string;
}

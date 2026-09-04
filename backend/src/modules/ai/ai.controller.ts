import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RequestMethod,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type MessageEvent,
} from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Observable } from 'rxjs';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import {
  assertUploadedFile,
  createChatAttachmentMulterOptions,
  uploadedFileUrl,
} from '@/common/lib/upload';
import { AiService } from './ai.service';
import type {
  AuditLogListItem,
  ChatAttachmentDto,
  ChatResult,
  ToolExecutionSummary,
} from './ai.types';
import { ChatRequestDto } from './dto/chat-request.dto';
import { AiConfiguredGuard } from './guards/ai-configured.guard';
import { AiOwnershipGuard } from './guards/ai-ownership.guard';

/** Вложено под конкретный бизнес — тот же принцип, что у `WebsitesController`
 * (`businesses/:businessId/website`): AI всегда работает в контексте одного
 * бизнеса, никогда не как ресурс верхнего уровня (см. `ToolContext` в
 * `ai.types.ts`). `AiOwnershipGuard` (владение бизнесом) применён на уровне
 * ВСЕГО контроллера — нужен каждому маршруту здесь, включая read-only
 * `GET activity`. `AiConfiguredGuard` (настроен ли LLM-провайдер) применён
 * ДОПОЛНИТЕЛЬНО на уровне метода только для `chat`/`chat/stream` — читать
 * ленту активности можно и когда провайдер сейчас не настроен, см.
 * `AiOwnershipGuard`'s комментарий про то, почему это два guard'а, а не один
 * `AiAvailabilityGuard`, как было раньше. */
@Controller('businesses/:businessId/ai')
@UseGuards(SessionAuthGuard, AiOwnershipGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** Синхронный запрос-ответ, без стриминга — оставлен как есть (curl-
   * верифицирован в §6-§9 роадмапа) для вызывающих, которым не нужен
   * прогресс по ходу выполнения. `chat/stream` ниже — тот же оркестратор
   * (`AiService.runToolLoop`), но с SSE (фаза AI-3). Лимит ниже строже, чем
   * у обычных CRUD-эндпоинтов — вызов реального LLM-провайдера с циклом
   * инструментов внутри, не дешёвая операция. */
  @Post('chat')
  @UseGuards(AiConfiguredGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  chat(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: ChatRequestDto,
  ): Promise<ChatResult> {
    return this.aiService.chat(businessId, currentUser.id, dto.message, dto.attachmentIds ?? []);
  }

  /** Тот же ход диалога, что и `chat()` выше, но эвенты цикла (`AiStreamEvent`
   * — начало/результат вызова инструмента, финальное сообщение) уходят в
   * клиент по мере готовности через SSE, не одним блоком в конце. `@Sse()` по
   * умолчанию — GET; здесь явно переопределён на POST (сообщение пользователя
   * в теле, как у обычного `chat()`, а не в query — предпочтительно для
   * потенциально длинного текста и для единообразия с `ChatRequestDto`).
   * Конфигурация/владение проверены `AiConfiguredGuard`/`AiOwnershipGuard` ДО
   * того, как Nest вообще узнаёт, что этот хендлер — SSE (см. их комментарии). */
  @Sse('chat/stream', { [METHOD_METADATA]: RequestMethod.POST })
  @UseGuards(AiConfiguredGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  chatStream(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: ChatRequestDto,
  ): Observable<MessageEvent> {
    return this.aiService.chatStream(
      businessId,
      currentUser.id,
      dto.message,
      dto.attachmentIds ?? [],
    );
  }

  /** Загрузка вложения ДО отправки сообщения — намеренно отдельный обычный
   * (не `@Sse()`) эндпоинт, а не мультипарт прямо в `chat/stream`: та `@Sse()`
   * уже один раз ловилась на гонке между её собственной "закоммитить заголовки
   * по таймеру" механикой и async-работой до построения `Observable` (см.
   * комментарий `AiOwnershipGuard`) — оборачивать в ту же ручку ещё и
   * multer/`FileInterceptor` было бы новым риском того же класса ради
   * экономии одного запроса. Без `AiConfiguredGuard` — загрузка файла не
   * дёргает LLM-провайдера вообще, доступна и когда он не настроен. */
  @Post('chat/attachments')
  @UseInterceptors(FileInterceptor('file', createChatAttachmentMulterOptions()))
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  uploadAttachment(@UploadedFile() file: Express.Multer.File | undefined): ChatAttachmentDto {
    assertUploadedFile(file);
    return {
      id: file.filename,
      name: file.originalname,
      mimeType: file.mimetype,
      url: uploadedFileUrl('messages', file.filename),
      sizeBytes: file.size,
    };
  }

  /** Лента активности AI (AI-3, "activity timeline", §10.7 роадмапа) —
   * последние `AuditLog`-записи для бизнеса, урезанные до того, что нужно
   * показать владельцу (`AuditLogListItem`, без сырых аргументов/результатов
   * инструментов). Не требует `AiConfiguredGuard` (см. класс-комментарий) —
   * история читается независимо от текущей настройки провайдера. Без
   * отдельного `@Throttle` — дешёвое чтение из БД, не вызов LLM. */
  @Get('activity')
  activity(@Param('businessId') businessId: string): Promise<AuditLogListItem[]> {
    return this.aiService.listActivity(businessId);
  }

  /** AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — выполняет `high`/`critical`
   * вызов, оставленный `chat`/`chat/stream` в состоянии `pending`
   * (`AiStreamEvent`'s `confirm_required`). Без `AiConfiguredGuard` — не
   * зовёт LLM вообще, тот же принцип, что у `activity` выше. */
  @Post('confirm/:confirmationId')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  confirmToolCall(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('confirmationId') confirmationId: string,
  ): Promise<ToolExecutionSummary> {
    return this.aiService.confirmToolCall(businessId, currentUser.id, confirmationId);
  }

  /** Отклоняет тот же `pending`-вызов без выполнения — см.
   * `AiService.rejectToolCall`. */
  @Post('reject/:confirmationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  rejectToolCall(
    @Param('businessId') businessId: string,
    @Param('confirmationId') confirmationId: string,
  ): Promise<void> {
    return this.aiService.rejectToolCall(businessId, confirmationId);
  }
}

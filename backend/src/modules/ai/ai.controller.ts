import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { AiService } from './ai.service';
import type { ChatResult } from './ai.types';
import { ChatRequestDto } from './dto/chat-request.dto';

/** Вложено под конкретный бизнес — тот же принцип, что у `WebsitesController`
 * (`businesses/:businessId/website`): AI всегда работает в контексте одного
 * бизнеса, никогда не как ресурс верхнего уровня (см. `ToolContext` в
 * `ai.types.ts`). */
@Controller('businesses/:businessId/ai')
@UseGuards(SessionAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /** Синхронный запрос-ответ, без стриминга — стриминг запланирован на фазу
   * AI-3 (см. `AI_PLATFORM_ROADMAP.md`), эта фаза (AI-1/AI-2) доказывает сам
   * pipe. Лимит ниже строже, чем у обычных CRUD-эндпоинтов — вызов реального
   * LLM-провайдера с циклом инструментов внутри, не дешёвая операция. */
  @Post('chat')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  chat(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: ChatRequestDto,
  ): Promise<ChatResult> {
    return this.aiService.chat(businessId, currentUser.id, dto.message);
  }
}

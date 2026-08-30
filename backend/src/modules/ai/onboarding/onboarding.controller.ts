import { Body, Controller, RequestMethod, Sse, UseGuards, type MessageEvent } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Throttle } from '@nestjs/throttler';
import type { Observable } from 'rxjs';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { AiConfiguredGuard } from '../guards/ai-configured.guard';
import { AiOnboardingService } from './onboarding.service';

/**
 * Верхнеуровневый маршрут (не вложен под `businesses/:businessId`, в отличие
 * от `AiController`) — намеренно: AI-4 onboarding-диалог (AI_PLATFORM_
 * ROADMAP.md §2.7) существует ДО того, как какой-либо бизнес создан, так что
 * `businessId` в URL структурно неоткуда взять. `AiOwnershipGuard`
 * (`AiController`) здесь не применим и не нужен — единственная проверка
 * "чей это запрос" — обычный `SessionAuthGuard`, тот же, что защищает
 * `/businesses` (список/создание бизнесов пользователя).
 *
 * Только SSE, без синхронного `chat()`-варианта (в отличие от
 * `AiController`, где оба появились по историческим причинам — `chat()` был
 * первым, стриминг добавился позже в AI-3) — фронтенду онбординга с самого
 * начала нужен только прогресс-стрим (`stream-ai-chat.ts` уже проверен в
 * бою для `chat/stream`, см. AI_PLATFORM_ROADMAP.md §10), дублировать
 * невостребованный синхронный путь ради единообразия нет смысла.
 */
@Controller('ai/onboarding')
@UseGuards(SessionAuthGuard, AiConfiguredGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: AiOnboardingService) {}

  @Sse('chat', { [METHOD_METADATA]: RequestMethod.POST })
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  chatStream(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: ChatRequestDto,
  ): Observable<MessageEvent> {
    return this.onboardingService.chatStream(currentUser.id, dto.message);
  }
}

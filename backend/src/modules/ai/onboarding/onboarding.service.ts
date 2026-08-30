import { Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { from, map, type Observable } from 'rxjs';
import { AuditLogService } from '../audit-log.service';
import { LlmProvider, type LlmMessage } from '../llm-provider';
import { OnboardingToolRegistryService } from './onboarding-tool-registry.service';
import type { OnboardingStreamEvent } from './onboarding.types';

/** См. `AiService`'s `MAX_TOOL_ITERATIONS` — тот же предел против
 * зацикливания модели, отдельная константа (не общий импорт), т.к. цикл
 * ниже — независимая копия, не разделяемая с `AiService.runToolLoop` (см.
 * комментарий класса про то, почему). */
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_INSTRUCTION = [
  'Ты — AI-ассистент, помогающий пользователю создать новый бизнес на платформе Tavern через диалог.',
  'У пользователя пока НЕТ ни одного бизнеса в этом диалоге — твоя единственная задача — собрать достаточно информации и вызвать инструмент create_business ровно один раз.',
  'Обязательно нужны: название и категория бизнеса. Описание и валюта — можно уточнить, но если пользователь торопится или не знает — не настаивай, вызови инструмент с тем, что есть.',
  'Не вызывай create_business, пока не знаешь хотя бы название и категорию — вместо этого задай уточняющий вопрос.',
  'После успешного вызова create_business кратко подтверди пользователю, что бизнес создан, и не вызывай инструмент повторно в этом же диалоге.',
  'У тебя нет других инструментов и никакого другого доступа к системе — не утверждай, что сделал что-то, чего не вызвал через create_business.',
  'Отвечай на русском языке, кратко и по-дружески.',
].join(' ');

/**
 * Оркестрация AI-4 conversational onboarding (AI_PLATFORM_ROADMAP.md §2.7) —
 * структурно параллельна `AiService.runToolLoop`, но НЕ переиспользует её
 * напрямую: `AiService`'s цикл жёстко завязан на `businessId: string`
 * (обязательный контекст каждого business-scoped инструмента) и на общий
 * `ToolRegistryService`, который держит инструменты, работающие с уже
 * существующим бизнесом (`add_block`, `set_style`...) — заводить их
 * доступными в диалоге, где бизнеса ещё нет, было бы дырой в области
 * видимости, а не просто лишним кодом. Дублирование ~60 строк цикла —
 * осознанный компромисс в пользу того, чтобы у онбординга не было
 * технической возможности дотянуться до business-scoped инструментов
 * (см. `OnboardingToolContext`/`OnboardingToolRegistryService`), а не
 * недосмотр — общий базовый класс/generic-обобщение здесь усложнили бы обе
 * стороны ради одного вызывающего.
 */
@Injectable()
export class AiOnboardingService {
  private readonly logger = new Logger(AiOnboardingService.name);

  constructor(
    private readonly llmProvider: LlmProvider,
    private readonly toolRegistry: OnboardingToolRegistryService,
    private readonly auditLog: AuditLogService,
  ) {}

  chatStream(actorId: string, userMessage: string): Observable<MessageEvent> {
    return from(this.runToolLoop(actorId, userMessage)).pipe(
      map((event): MessageEvent => ({ data: event })),
    );
  }

  private async *runToolLoop(
    actorId: string,
    userMessage: string,
  ): AsyncGenerator<OnboardingStreamEvent, void, void> {
    const tools = this.toolRegistry.list();
    const toolSchemas = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const messages: LlmMessage[] = [{ role: 'user', content: userMessage }];
    let executedAny = false;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      let result: Awaited<ReturnType<LlmProvider['chat']>>;
      try {
        result = await this.llmProvider.chat(messages, toolSchemas, SYSTEM_INSTRUCTION);
      } catch (error) {
        // См. `AiService.runToolLoop`'s тот же блок — если create_business уже
        // реально выполнился (бизнес создан в БД), сбой именно follow-up
        // вызова модели не должен превратиться в голый 500, скрывающий, что
        // бизнес уже есть.
        if (executedAny) {
          this.logger.warn(
            `Follow-up вызов LLM упал после успешного create_business: ${error instanceof Error ? error.message : String(error)}`,
          );
          yield {
            type: 'message',
            message:
              'Бизнес создан, но не удалось получить финальный ответ ассистента (сбой у AI-провайдера). Откройте список бизнесов, чтобы найти его.',
          };
          return;
        }
        throw error;
      }

      if (result.toolCalls.length === 0) {
        yield { type: 'message', message: result.message ?? '' };
        return;
      }

      messages.push({
        role: 'assistant',
        content: result.message ?? undefined,
        toolCalls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        const tool = this.toolRegistry.get(call.name);
        const riskLevel = tool?.riskLevel ?? 'low';
        yield { type: 'tool_start', tool: call.name, riskLevel };

        let status: 'success' | 'error' = 'success';
        let outputForModel: unknown;
        let argsForAudit: unknown = call.args;
        let createdBusinessId: string | null = null;

        if (!tool) {
          status = 'error';
          outputForModel = { error: `Неизвестный инструмент: ${call.name}` };
        } else {
          try {
            const input = tool.parseInput(call.args);
            argsForAudit = input;
            const output = await tool.handler(input, { actorId });
            outputForModel = output;
            if (
              call.name === 'create_business' &&
              typeof output === 'object' &&
              output !== null &&
              'businessId' in output
            ) {
              createdBusinessId = String(output.businessId);
            }
          } catch (error) {
            status = 'error';
            outputForModel = {
              error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            };
          }
        }

        await this.auditLog.record({
          actorId,
          businessId: createdBusinessId,
          tool: call.name,
          riskLevel,
          argsSummary: argsForAudit,
          status,
          resultSummary: outputForModel,
        });

        executedAny = true;
        yield { type: 'tool_result', tool: call.name, riskLevel, status };

        if (status === 'success' && createdBusinessId !== null) {
          const output = outputForModel as { businessId: string; slug: string };
          yield { type: 'business_created', businessId: output.businessId, slug: output.slug };
        }

        messages.push({
          role: 'tool',
          toolCallId: call.id,
          toolName: call.name,
          content: JSON.stringify(outputForModel),
        });
      }
    }

    throw new Error('AI превысил лимит шагов инструментов для одного сообщения');
  }
}

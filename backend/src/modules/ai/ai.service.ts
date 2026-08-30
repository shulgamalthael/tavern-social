import { Injectable, Logger, type MessageEvent } from '@nestjs/common';
import { from, map, type Observable } from 'rxjs';
import type { AiStreamEvent, AuditLogListItem, ChatResult } from './ai.types';
import { AuditLogService } from './audit-log.service';
import { LlmProvider, type LlmMessage } from './llm-provider';
import { ToolRegistryService } from './tools/tool-registry.service';

/** Жёсткий потолок на число раундов «модель просит инструмент(ы) →
 * выполняем → отдаём результат» внутри ОДНОГО пользовательского сообщения —
 * защита от зацикливания модели (mission §61/§103 про идемпотентность и
 * восстановление после сбоя подразумевают предел, явно нигде не назван).
 * 5 достаточно с большим запасом для AI-1 (один read-only инструмент). */
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_INSTRUCTION = [
  'Ты — AI-ассистент, встроенный в конструктор сайтов и бизнес-платформу Tavern.',
  'Ты можешь действовать ТОЛЬКО через предоставленные тебе инструменты (tools) — у тебя нет никакого другого доступа к системе.',
  'Эта платформа находится на очень раннем этапе интеграции с AI: набор доступных тебе инструментов сейчас маленький и может не покрывать то, что умеет сам конструктор целиком.',
  'НИКОГДА не описывай и не перечисляй возможности, для которых у тебя нет инструмента прямо сейчас — если пользователь спрашивает, что ты умеешь, отвечай только исходя из реально переданного тебе списка инструментов, а не исходя из общих представлений о том, что умеет типичный конструктор сайтов.',
  'Ты всегда работаешь в контексте ОДНОГО конкретного бизнеса, уже выбранного пользователем — ты не можешь и не должен пытаться работать с каким-либо другим бизнесом или запрашивать его id.',
  'Если для ответа пользователю не нужен ни один инструмент — просто ответь текстом, без вызова инструментов.',
  'Никогда не утверждай, что выполнил действие, которое реально не вызвал через инструмент.',
  'Отвечай на русском языке, кратко и по делу.',
].join(' ');

/**
 * Оркестрация одного AI-диалогового хода (mission §63-64 planner/builder,
 * упрощённо для AI-1/AI-2 — без явного отдельного Reviewer/Fixer, они
 * появятся вместе с записывающими инструментами, см.
 * AI_PLATFORM_ROADMAP.md, фазы AI-2+). Каждый вызов инструмента — через
 * `ToolRegistryService`, с audit-логом независимо от результата.
 *
 * Конфигурация провайдера и владение бизнесом НЕ проверяются здесь — это
 * `AiConfiguredGuard`/`AiOwnershipGuard` (`AiController`, `@UseGuards`), см.
 * их комментарии: для `chatStream`/SSE это не стилистический выбор, а
 * обязательное условие (обнаруженная вживую гонка между `@Sse()`'s
 * заголовками-по-таймеру и любой async-проверкой внутри самого хендлера).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly llmProvider: LlmProvider,
    private readonly toolRegistry: ToolRegistryService,
    private readonly auditLog: AuditLogService,
  ) {}

  async chat(businessId: string, actorId: string, userMessage: string): Promise<ChatResult> {
    const executions: ChatResult['toolExecutions'] = [];
    let message = '';

    for await (const event of this.runToolLoop(businessId, actorId, userMessage)) {
      if (event.type === 'tool_result') {
        executions.push({ tool: event.tool, riskLevel: event.riskLevel, status: event.status });
      } else if (event.type === 'message') {
        message = event.message;
      }
    }

    return { message, toolExecutions: executions };
  }

  /** Тот же цикл, что и `chat()`, но отдаёт прогресс через SSE (AI-3, см.
   * AI_PLATFORM_ROADMAP.md) вместо ожидания всего хода целиком. Ошибки
   * ВНУТРИ цикла (лимит итераций, сбой LLM-провайдера на первом вызове
   * хода) — исключения из `runToolLoop`, попадают в стандартный
   * `event: error`, который Nest формирует сам. */
  chatStream(businessId: string, actorId: string, userMessage: string): Observable<MessageEvent> {
    return from(this.runToolLoop(businessId, actorId, userMessage)).pipe(
      map((event): MessageEvent => ({ data: event })),
    );
  }

  /** Лента активности AI для бизнеса (AI-3, "activity timeline", §10.7
   * роадмапа) — тонкая обёртка над `AuditLogService.listForBusiness`,
   * сохраняющая тот же слой вызовов, что и `chat`/`chatStream`
   * (`Controller` → `AiService` → нижележащий сервис), а не прямой вызов
   * `AuditLogService` из контроллера в обход `AiService`. */
  listActivity(businessId: string): Promise<AuditLogListItem[]> {
    return this.auditLog.listForBusiness(businessId);
  }

  /** Общий цикл «модель просит инструмент(ы) → выполняем → отдаём результат»
   * для `chat()` и `chatStream()` — единственное место, где реально
   * выполняются инструменты и пишется `AuditLog`, чтобы обе точки входа
   * гарантированно вели себя одинаково (см. AI_PLATFORM_ROADMAP.md §2.8 про
   * audit log как обязательную часть первой же итерации, не опциональную
   * доводку). */
  private async *runToolLoop(
    businessId: string,
    actorId: string,
    userMessage: string,
  ): AsyncGenerator<AiStreamEvent, void, void> {
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
        // Инструмент(ы) уже реально выполнились в предыдущих итерациях этого
        // же хода (мутация уже закоммичена в БД) — сбой ИМЕННО этого,
        // следующего вызова модели (например, временный 429 у провайдера,
        // см. AI_PLATFORM_ROADMAP.md §7) не должен превращаться в голый 500,
        // который скрывает от пользователя, что действие уже произошло.
        // Если инструменты ещё не выполнялись (сбой на самом первом вызове),
        // это обычный сквозной сбой — пробрасываем как раньше.
        if (executedAny) {
          this.logger.warn(
            `Follow-up вызов LLM упал после успешно выполненных инструментов: ${error instanceof Error ? error.message : String(error)}`,
          );
          yield {
            type: 'message',
            message:
              'Действие выполнено, но не удалось получить финальный ответ ассистента (сбой у AI-провайдера). Проверьте результат вручную.',
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
        // `AuditLog.argsSummary` документирован как аргументы ПОСЛЕ парсинга/
        // валидации (см. комментарий столбца в schema.prisma) — не то, что
        // сырым прислала модель. Стартуем с `call.args` как фолбэком на
        // случай, если `parseInput` сам бросит (тогда провалидированной формы
        // никогда не появится, но в аудите всё равно должно быть видно, ЧТО
        // именно модель пыталась передать) — успешный `parseInput` ниже
        // перезаписывает его нормализованным значением (например, `create_
        // page` обрезает пробелы у `title`, `add_block` подставляет дефолты
        // для непереданных `props`).
        let argsForAudit: unknown = call.args;

        if (!tool) {
          status = 'error';
          outputForModel = { error: `Неизвестный инструмент: ${call.name}` };
        } else {
          try {
            const input = tool.parseInput(call.args);
            argsForAudit = input;
            outputForModel = await tool.handler(input, { actorId, businessId });
          } catch (error) {
            status = 'error';
            outputForModel = {
              error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            };
          }
        }

        await this.auditLog.record({
          actorId,
          businessId,
          tool: call.name,
          riskLevel,
          argsSummary: argsForAudit,
          status,
          resultSummary: outputForModel,
        });

        executedAny = true;
        yield { type: 'tool_result', tool: call.name, riskLevel, status };

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

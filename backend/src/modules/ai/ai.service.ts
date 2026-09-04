import { readFileSync } from 'node:fs';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type MessageEvent,
} from '@nestjs/common';
import { from, map, type Observable } from 'rxjs';
import {
  deleteUploadedFile,
  mimeTypeForChatAttachment,
  resolveChatAttachmentPath,
  uploadedFileUrl,
} from '@/common/lib/upload';
import type { AiStreamEvent, AuditLogListItem, ChatResult, ToolExecutionSummary } from './ai.types';
import { AuditLogService } from './audit-log.service';
import { AiGatewayService } from './capacity/ai-gateway.service';
import type { LlmMessage } from './llm-provider';
import { ToolRegistryService } from './tools/tool-registry.service';

/** Жёсткий потолок на число раундов «модель просит инструмент(ы) →
 * выполняем → отдаём результат» внутри ОДНОГО пользовательского сообщения —
 * защита от зацикливания модели (mission §61/§103 про идемпотентность и
 * восстановление после сбоя подразумевают предел, явно нигде не назван).
 * Раньше было 5 — хватало с запасом на AI-1 (один read-only инструмент за
 * ход). После расширения `add_block` на весь реестр блоков (48 типов) и
 * вложенности через `parentId` (см. `AddBlockTool`) один ход почти всегда
 * СЕРИЙНЫЙ, не батчуемый целиком: чтобы вложить `column` в `columns`, модель
 * обязана сначала получить id только что созданного `columns` из ОТВЕТА
 * предыдущего раунда — уровень вложенности не сжать в один батч тул-коллов,
 * даже если модель следует совету из `SYSTEM_INSTRUCTION` батчить всё, что
 * можно (independent top-level блоки). Реалистичная многосекционная
 * страница (шапка, hero, секция с сайдбаром — 2 уровня вложенности, ещё
 * пара обычных секций, подвал) — это уже 6-10 раундов, не 1-2; 15 даёт
 * комфортный запас, оставаясь конечным пределом, а не «без лимита». */
const MAX_TOOL_ITERATIONS = 15;

const SYSTEM_INSTRUCTION = [
  'Ты — AI-ассистент, встроенный в конструктор сайтов и бизнес-платформу Tavern.',
  'Ты можешь действовать ТОЛЬКО через предоставленные тебе инструменты (tools) — у тебя нет никакого другого доступа к системе.',
  'Эта платформа находится на очень раннем этапе интеграции с AI: набор доступных тебе инструментов сейчас маленький и может не покрывать то, что умеет сам конструктор целиком.',
  'НИКОГДА не описывай и не перечисляй возможности, для которых у тебя нет инструмента прямо сейчас — если пользователь спрашивает, что ты умеешь, отвечай только исходя из реально переданного тебе списка инструментов, а не исходя из общих представлений о том, что умеет типичный конструктор сайтов.',
  'Ты всегда работаешь в контексте ОДНОГО конкретного бизнеса, уже выбранного пользователем — ты не можешь и не должен пытаться работать с каким-либо другим бизнесом или запрашивать его id.',
  'У тебя большой набор типов блоков (структура, текст, медиа, бизнес-секции, товары/услуги/блог, формы, навигация) — вызови get_block_schema без аргументов, чтобы увидеть полный список по категориям, и с blockType, чтобы получить точные поля перед add_block/update_block_props этим типом. Не придумывай поля по памяти, если не уверен.',
  'Ты умеешь строить многоколоночные раскладки и сайдбары: add_block с типом section/container/columns/column и parentId, затем set_style с полями раскладки (display/direction/gap/gridColumns/justify/align на контейнере, grow/fixedWidth/sticky на его детях) — подробности в описании самих инструментов add_block/set_style, обращайся к ним, а не изобретай структуру заранее.',
  'Ты умеешь исправлять СТРУКТУРНЫЕ ошибки, а не только props/style: move_block переставляет/переносит уже существующий блок (без потери данных), delete_block безвозвратно удаляет блок вместе со всеми его children — перед delete_block предупреждай о последствиях в своём тексте, подробности в описании обоих инструментов.',
  'Когда собираешь многоблочную страницу, запрашивай НЕСКОЛЬКО инструментов за один свой ответ там, где это уместно (например, все add_block для дочерних колонок сразу), а не по одному инструменту на ответ — это экономит количество ходов в одном сообщении пользователя.',
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
    private readonly aiGateway: AiGatewayService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly auditLog: AuditLogService,
  ) {}

  async chat(
    businessId: string,
    actorId: string,
    userMessage: string,
    attachmentIds: string[] = [],
  ): Promise<ChatResult> {
    const executions: ChatResult['toolExecutions'] = [];
    let message = '';
    let confirmRequired: ChatResult['confirmRequired'];

    for await (const event of this.runToolLoop(businessId, actorId, userMessage, attachmentIds)) {
      if (event.type === 'tool_result') {
        executions.push({ tool: event.tool, riskLevel: event.riskLevel, status: event.status });
      } else if (event.type === 'message') {
        message = event.message;
      } else if (event.type === 'confirm_required') {
        confirmRequired = {
          tool: event.tool,
          riskLevel: event.riskLevel,
          confirmationId: event.confirmationId,
          args: event.args,
        };
      }
    }

    return { message, toolExecutions: executions, confirmRequired };
  }

  /** AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — выполняет `pending`-вызов,
   * поставленный в очередь `runToolLoop` (см. её комментарий про `high`/
   * `critical`-ветку), РОВНО с теми аргументами, что были провалидированы в
   * момент постановки — не просит модель повторить вызов и не парсит
   * аргументы заново (модель в этом шаге вообще не участвует). Не находит
   * `pending`-строку с этим `id` внутри `businessId` → `404` (несуществующий
   * `id`, чужой бизнес и уже обработанное подтверждение неотличимы по
   * ответу, тот же принцип, что у `findOwned*`-методов остального проекта). */
  async confirmToolCall(
    businessId: string,
    actorId: string,
    confirmationId: string,
  ): Promise<ToolExecutionSummary> {
    const pending = await this.auditLog.findOwnedPending(confirmationId, businessId);
    if (!pending) throw new NotFoundException('Подтверждение не найдено или уже обработано');

    const tool = this.toolRegistry.get(pending.tool);
    if (!tool) {
      const outputForModel = { error: `Инструмент "${pending.tool}" больше не зарегистрирован` };
      await this.auditLog.resolvePending(confirmationId, {
        status: 'error',
        resultSummary: outputForModel,
      });
      return { tool: pending.tool, riskLevel: pending.riskLevel, status: 'error' };
    }

    let status: 'success' | 'error' = 'success';
    let outputForModel: unknown;
    try {
      outputForModel = await tool.handler(pending.argsSummary, { actorId, businessId });
    } catch (error) {
      status = 'error';
      outputForModel = { error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }

    await this.auditLog.resolvePending(confirmationId, { status, resultSummary: outputForModel });
    return { tool: pending.tool, riskLevel: pending.riskLevel, status };
  }

  /** Отклоняет `pending`-вызов без выполнения — переводит его строку
   * `AuditLog` сразу в `rejected`, инструмент так и не запускается. Не
   * принимает `actorId` (в отличие от `confirmToolCall`) — отклонение не
   * выполняет `tool.handler`, которому он нужен как часть `ToolContext`,
   * владение уже проверено `AiOwnershipGuard` через `businessId`. */
  async rejectToolCall(businessId: string, confirmationId: string): Promise<void> {
    const pending = await this.auditLog.findOwnedPending(confirmationId, businessId);
    if (!pending) throw new NotFoundException('Подтверждение не найдено или уже обработано');
    await this.auditLog.resolvePending(confirmationId, { status: 'rejected' });
  }

  /** Тот же цикл, что и `chat()`, но отдаёт прогресс через SSE (AI-3, см.
   * AI_PLATFORM_ROADMAP.md) вместо ожидания всего хода целиком. Ошибки
   * ВНУТРИ цикла (лимит итераций, сбой LLM-провайдера на первом вызове
   * хода) — исключения из `runToolLoop`, попадают в стандартный
   * `event: error`, который Nest формирует сам. */
  chatStream(
    businessId: string,
    actorId: string,
    userMessage: string,
    attachmentIds: string[] = [],
  ): Observable<MessageEvent> {
    return from(this.runToolLoop(businessId, actorId, userMessage, attachmentIds)).pipe(
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
    attachmentIds: string[] = [],
  ): AsyncGenerator<AiStreamEvent, void, void> {
    const tools = this.toolRegistry.list();
    const toolSchemas = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    // Вложения читаются с диска и кодируются в base64 ДО первого вызова
    // модели, а удаляются в `finally` ниже сразу после хода (успешного или
    // нет) — тот же принцип «без памяти между HTTP-вызовами», что и у
    // остального диалога здесь (`messages` стартует с нуля на каждый вызов
    // `chat`/`chatStream`): держать файл дольше одного хода бессмысленно, а
    // хранить их бессрочно на диске (одна дизайн-картинка — и всё, больше
    // модель её не увидит) незачем и раздувает `uploads/messages/`.
    let attachments: LlmMessage['attachments'];
    try {
      attachments = attachmentIds.map((id) => {
        const path = resolveChatAttachmentPath(id);
        const mimeType = mimeTypeForChatAttachment(id);
        if (!mimeType) throw new BadRequestException('Некорректный id вложения');
        return { mimeType, data: readFileSync(path).toString('base64') };
      });
    } catch (error) {
      this.logger.warn(
        `Не удалось прочитать вложение чата: ${error instanceof Error ? error.message : String(error)}`,
      );
      yield {
        type: 'message',
        message: 'Не удалось прочитать вложение — прикрепите файл заново и отправьте ещё раз.',
      };
      return;
    }

    try {
      const messages: LlmMessage[] = [{ role: 'user', content: userMessage, attachments }];
      let executedAny = false;

      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        let result: Awaited<ReturnType<AiGatewayService['chat']>>;
        try {
          result = await this.aiGateway.chat(messages, toolSchemas, SYSTEM_INSTRUCTION, {
            operation: 'business_chat',
            businessId,
            actorId,
          });
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

          // `AuditLog.argsSummary` документирован как аргументы ПОСЛЕ парсинга/
          // валидации (см. комментарий столбца в schema.prisma) — не то, что
          // сырым прислала модель. Стартуем с `call.args` как фолбэком на
          // случай, если `parseInput` сам бросит (тогда провалидированной формы
          // никогда не появится, но в аудите всё равно должно быть видно, ЧТО
          // именно модель пыталась передать) — успешный `parseInput` ниже
          // перезаписывает его нормализованным значением.
          let argsForAudit: unknown = call.args;

          if (!tool) {
            const outputForModel = { error: `Неизвестный инструмент: ${call.name}` };
            await this.auditLog.record({
              actorId,
              businessId,
              tool: call.name,
              riskLevel,
              argsSummary: argsForAudit,
              status: 'error',
              resultSummary: outputForModel,
            });
            executedAny = true;
            yield { type: 'tool_result', tool: call.name, riskLevel, status: 'error' };
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              toolName: call.name,
              content: JSON.stringify(outputForModel),
            });
            continue;
          }

          let input: unknown;
          try {
            input = tool.parseInput(call.args);
            argsForAudit = input;
          } catch (error) {
            const outputForModel = {
              error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            };
            await this.auditLog.record({
              actorId,
              businessId,
              tool: call.name,
              riskLevel,
              argsSummary: argsForAudit,
              status: 'error',
              resultSummary: outputForModel,
            });
            executedAny = true;
            yield { type: 'tool_result', tool: call.name, riskLevel, status: 'error' };
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              toolName: call.name,
              content: JSON.stringify(outputForModel),
            });
            continue;
          }

          // AI-9 (AI_PLATFORM_ROADMAP.md §2.8/§21) — `high`/`critical` вызов
          // уже провалидирован, но НЕ выполняется здесь: ставим `pending`-
          // строку `AuditLog` и останавливаем весь ход диалога (не только
          // этот вызов инструмента) — владелец подтверждает/отклоняет
          // отдельным REST-вызовом (`confirmToolCall`/`rejectToolCall`),
          // который выполняет РОВНО этот вызов с теми же аргументами, не
          // просит модель повторить его. Любые другие вызовы инструментов,
          // которые модель могла запросить в этом же батче ПОСЛЕ этого,
          // намеренно не выполняются в этом ходу — реальный, а не
          // гипотетический сценарий (модель может попросить несколько
          // инструментов за один ход, см. AI_PLATFORM_ROADMAP.md §8.3), первая
          // ограниченная версия этого механизма его не покрывает.
          if (riskLevel === 'high' || riskLevel === 'critical') {
            const confirmationId = await this.auditLog.record({
              actorId,
              businessId,
              tool: call.name,
              riskLevel,
              argsSummary: input,
              status: 'pending',
            });
            yield {
              type: 'confirm_required',
              tool: call.name,
              riskLevel,
              confirmationId,
              args: input,
            };
            return;
          }

          let status: 'success' | 'error' = 'success';
          let outputForModel: unknown;
          try {
            outputForModel = await tool.handler(input, { actorId, businessId });
          } catch (error) {
            status = 'error';
            outputForModel = {
              error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            };
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
    } finally {
      for (const id of attachmentIds) deleteUploadedFile(uploadedFileUrl('messages', id));
    }
  }
}

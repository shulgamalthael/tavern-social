import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { ChatResult, ToolExecutionSummary } from './ai.types';
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
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmProvider: LlmProvider,
    private readonly toolRegistry: ToolRegistryService,
    private readonly auditLog: AuditLogService,
  ) {}

  async chat(businessId: string, actorId: string, userMessage: string): Promise<ChatResult> {
    if (!this.llmProvider.isConfigured()) {
      throw new ServiceUnavailableException('AI ещё не настроен на этом сервере');
    }

    await this.assertOwnership(businessId, actorId);

    const tools = this.toolRegistry.list();
    const toolSchemas = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const messages: LlmMessage[] = [{ role: 'user', content: userMessage }];
    const executions: ToolExecutionSummary[] = [];

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
        if (executions.length > 0) {
          this.logger.warn(
            `Follow-up вызов LLM упал после ${executions.length} успешно выполненных инструментов: ${error instanceof Error ? error.message : String(error)}`,
          );
          return {
            message:
              'Действие выполнено, но не удалось получить финальный ответ ассистента (сбой у AI-провайдера). Проверьте результат вручную.',
            toolExecutions: executions,
          };
        }
        throw error;
      }

      if (result.toolCalls.length === 0) {
        return { message: result.message ?? '', toolExecutions: executions };
      }

      messages.push({
        role: 'assistant',
        content: result.message ?? undefined,
        toolCalls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        const tool = this.toolRegistry.get(call.name);
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
          riskLevel: tool?.riskLevel ?? 'low',
          argsSummary: argsForAudit,
          status,
          resultSummary: outputForModel,
        });

        executions.push({ tool: call.name, riskLevel: tool?.riskLevel ?? 'low', status });

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

  /** Тот же принцип, что и в `WebsitesService`/`BusinessesService` — каждый
   * модуль сам проверяет владение бизнесом напрямую через Prisma, не
   * полагаясь на общий helper (см. AI_PLATFORM_ROADMAP.md §0.1: в этом
   * проекте "tenant" — это буквально `Business.ownerId`). */
  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }
}

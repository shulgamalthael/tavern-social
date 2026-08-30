import { Injectable } from '@nestjs/common';
import type { ToolDefinition } from '../ai.types';

/**
 * Реестр AI-инструментов (mission §6/§59, AI_PLATFORM_ROADMAP.md §2.1) —
 * плоская карта по имени, без единого "do_everything" обработчика. Каждый
 * инструмент регистрирует себя сам (`OnModuleInit` в своём классе, см.
 * `GetProjectTreeTool`) — добавление нового инструмента не требует правки
 * этого файла или `AiService`.
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  /**
   * Принимает конкретно типизированный `ToolDefinition<TInput, TOutput>` —
   * стирание до `unknown` внутри намеренно и безопасно: реестр по
   * определению разнороден (разные инструменты — разные типы), а
   * типобезопасность самого инструмента гарантируется в месте его
   * определения (`parseInput`/`handler` там видят свои настоящие типы).
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`AI-инструмент "${tool.name}" уже зарегистрирован`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. комментарий метода: реестр намеренно стирает конкретный тип инструмента до unknown
    this.tools.set(tool.name, tool as ToolDefinition<any, any>);
  }

  get(name: string): ToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition<unknown, unknown>[] {
    return [...this.tools.values()];
  }
}

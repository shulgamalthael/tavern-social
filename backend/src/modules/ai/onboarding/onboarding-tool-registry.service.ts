import { Injectable } from '@nestjs/common';
import type { OnboardingToolDefinition } from './onboarding.types';

/**
 * Отдельный реестр инструментов для AI-4 onboarding-диалога — не переиспользует
 * `ToolRegistryService` (`../tools/tool-registry.service.ts`) намеренно: тот
 * реестр держит business-scoped инструменты (`add_block`, `set_style`...),
 * которые онбординг-диалогу должны быть структурно недоступны (бизнеса ещё
 * нет, `OnboardingToolContext` не несёт `businessId`) — два реестра делают
 * это гарантией типов и области видимости DI, а не соглашением, которое
 * можно случайно нарушить одной лишней регистрацией в общем реестре.
 */
@Injectable()
export class OnboardingToolRegistryService {
  private readonly tools = new Map<string, OnboardingToolDefinition<unknown, unknown>>();

  register<TInput, TOutput>(tool: OnboardingToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Onboarding AI-инструмент "${tool.name}" уже зарегистрирован`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. ToolRegistryService.register: реестр намеренно стирает конкретный тип инструмента до unknown
    this.tools.set(tool.name, tool as OnboardingToolDefinition<any, any>);
  }

  get(name: string): OnboardingToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  list(): OnboardingToolDefinition<unknown, unknown>[] {
    return [...this.tools.values()];
  }
}

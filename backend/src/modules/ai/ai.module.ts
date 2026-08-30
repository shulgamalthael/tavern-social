import { Module } from '@nestjs/common';
import { BusinessesModule } from '@/modules/businesses/businesses.module';
import { WebsitesModule } from '@/modules/websites/websites.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuditLogService } from './audit-log.service';
import { AiConfiguredGuard } from './guards/ai-configured.guard';
import { AiOwnershipGuard } from './guards/ai-ownership.guard';
import { LlmProvider } from './llm-provider';
import { OnboardingToolRegistryService } from './onboarding/onboarding-tool-registry.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { AiOnboardingService } from './onboarding/onboarding.service';
import { CreateBusinessTool } from './onboarding/tools/create-business.tool';
import { GeminiAdapter } from './providers/gemini-adapter.service';
import { AddBlockTool } from './tools/add-block.tool';
import { CreatePageTool } from './tools/create-page.tool';
import { GetProjectTreeTool } from './tools/get-project-tree.tool';
import { SetStyleTool } from './tools/set-style.tool';
import { ToolRegistryService } from './tools/tool-registry.service';
import { UpdateBlockPropsTool } from './tools/update-block-props.tool';

@Module({
  imports: [WebsitesModule, BusinessesModule],
  controllers: [AiController, OnboardingController],
  providers: [
    AiService,
    AuditLogService,
    AiOwnershipGuard,
    AiConfiguredGuard,
    ToolRegistryService,
    { provide: LlmProvider, useClass: GeminiAdapter },
    // Каждый инструмент — отдельный provider, регистрирующий себя в
    // ToolRegistryService через OnModuleInit (см. GetProjectTreeTool) —
    // добавление нового инструмента = новый файл + строка здесь, без правки
    // AiService/ToolRegistryService.
    GetProjectTreeTool,
    CreatePageTool,
    AddBlockTool,
    SetStyleTool,
    UpdateBlockPropsTool,
    // AI-4 onboarding (AI_PLATFORM_ROADMAP.md §2.7) — отдельный сервис/реестр/
    // контроллер (см. их комментарии), не расширение business-scoped стека
    // выше.
    AiOnboardingService,
    OnboardingToolRegistryService,
    CreateBusinessTool,
  ],
})
export class AiModule {}

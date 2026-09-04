import { Module } from '@nestjs/common';
import { BusinessesModule } from '@/modules/businesses/businesses.module';
import { CustomEntitiesModule } from '@/modules/custom-entities/custom-entities.module';
import { CustomWidgetsModule } from '@/modules/custom-widgets/custom-widgets.module';
import { MediaAssetsModule } from '@/modules/media-assets/media-assets.module';
import { Web3Module } from '@/modules/web3/web3.module';
import { WebsitesModule } from '@/modules/websites/websites.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuditLogService } from './audit-log.service';
import { AiAlertsService } from './capacity/ai-alerts.service';
import { AiAnomalyService } from './capacity/ai-anomaly.service';
import { AiBudgetService } from './capacity/ai-budget.service';
import { AiCapacityService } from './capacity/ai-capacity.service';
import { AiDedupCacheService } from './capacity/ai-dedup-cache.service';
import { AiForecastService } from './capacity/ai-forecast.service';
import { AiGatewayService } from './capacity/ai-gateway.service';
import { AiInfrastructureController } from './capacity/ai-infrastructure.controller';
import { AiRecommendationsService } from './capacity/ai-recommendations.service';
import { AiRequestAccountingService } from './capacity/ai-request-accounting.service';
import { AiRetentionService } from './capacity/ai-retention.service';
import { AiConfiguredGuard } from './guards/ai-configured.guard';
import { AiOwnershipGuard } from './guards/ai-ownership.guard';
import { LlmProvider } from './llm-provider';
import { OnboardingToolRegistryService } from './onboarding/onboarding-tool-registry.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { AiOnboardingService } from './onboarding/onboarding.service';
import { CreateBusinessTool } from './onboarding/tools/create-business.tool';
import { GeminiAdapter } from './providers/gemini-adapter.service';
import { GeminiQuotaService } from './quota/gemini-quota.service';
import { AddBlockTool } from './tools/add-block.tool';
import { AddFieldTool } from './tools/add-field.tool';
import { CreateCustomWidgetTool } from './tools/create-custom-widget.tool';
import { CreateEntityTool } from './tools/create-entity.tool';
import { CreatePageTool } from './tools/create-page.tool';
import { DeleteBlockTool } from './tools/delete-block.tool';
import { GetBlockTool } from './tools/get-block.tool';
import { GetBlockSchemaTool } from './tools/get-block-schema.tool';
import { GetPageBlocksTool } from './tools/get-page-blocks.tool';
import { GetProjectTreeTool } from './tools/get-project-tree.tool';
import { GetWalletInfoTool } from './tools/get-wallet-info.tool';
import { ListEntitiesTool } from './tools/list-entities.tool';
import { ListMediaAssetsTool } from './tools/list-media-assets.tool';
import { MoveBlockTool } from './tools/move-block.tool';
import { PublishWebsiteTool } from './tools/publish-website.tool';
import { SetStyleTool } from './tools/set-style.tool';
import { ToolRegistryService } from './tools/tool-registry.service';
import { UpdateBlockPropsTool } from './tools/update-block-props.tool';

@Module({
  imports: [
    WebsitesModule,
    BusinessesModule,
    CustomWidgetsModule,
    CustomEntitiesModule,
    MediaAssetsModule,
    Web3Module,
  ],
  controllers: [AiController, OnboardingController, AiInfrastructureController],
  providers: [
    AiService,
    AuditLogService,
    AiOwnershipGuard,
    AiConfiguredGuard,
    ToolRegistryService,
    // Redis-бэкенд глобального RPM/RPD-лимитера Gemini (`GeminiQuotaService`,
    // GEMINI OPTIMIZATION §6-10) — `RedisModule` глобальный (`@Global()`),
    // `REDIS_CLIENT` доступен без отдельного `imports` здесь.
    GeminiQuotaService,
    { provide: LlmProvider, useClass: GeminiAdapter },
    // AI Capacity & Cost Manager — `AiGatewayService` (`capacity/ai-gateway.
    // service.ts`) единственная точка входа для `AiService`/`AiOnboardingService`,
    // остальные — её зависимости (см. их комментарии). `AiCapacityService`/
    // `AiRecommendationsService`/`AiRetentionService` заводят собственные
    // фоновые таймеры через `OnModuleInit` — им достаточно быть в этом списке
    // providers, Nest сам их проинициализирует при старте модуля.
    AiGatewayService,
    AiDedupCacheService,
    AiCapacityService,
    AiBudgetService,
    AiAlertsService,
    AiAnomalyService,
    AiForecastService,
    AiRecommendationsService,
    AiRetentionService,
    AiRequestAccountingService,
    // Каждый инструмент — отдельный provider, регистрирующий себя в
    // ToolRegistryService через OnModuleInit (см. GetProjectTreeTool) —
    // добавление нового инструмента = новый файл + строка здесь, без правки
    // AiService/ToolRegistryService.
    GetProjectTreeTool,
    GetPageBlocksTool,
    GetBlockTool,
    GetBlockSchemaTool,
    CreatePageTool,
    AddBlockTool,
    SetStyleTool,
    UpdateBlockPropsTool,
    DeleteBlockTool,
    MoveBlockTool,
    ListMediaAssetsTool,
    CreateCustomWidgetTool,
    GetWalletInfoTool,
    ListEntitiesTool,
    CreateEntityTool,
    AddFieldTool,
    PublishWebsiteTool,
    // AI-4 onboarding (AI_PLATFORM_ROADMAP.md §2.7) — отдельный сервис/реестр/
    // контроллер (см. их комментарии), не расширение business-scoped стека
    // выше.
    AiOnboardingService,
    OnboardingToolRegistryService,
    CreateBusinessTool,
  ],
})
export class AiModule {}

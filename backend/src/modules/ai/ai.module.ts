import { Module } from '@nestjs/common';
import { WebsitesModule } from '@/modules/websites/websites.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuditLogService } from './audit-log.service';
import { LlmProvider } from './llm-provider';
import { GeminiAdapter } from './providers/gemini-adapter.service';
import { AddBlockTool } from './tools/add-block.tool';
import { CreatePageTool } from './tools/create-page.tool';
import { GetProjectTreeTool } from './tools/get-project-tree.tool';
import { SetStyleTool } from './tools/set-style.tool';
import { ToolRegistryService } from './tools/tool-registry.service';
import { UpdateBlockPropsTool } from './tools/update-block-props.tool';

@Module({
  imports: [WebsitesModule],
  controllers: [AiController],
  providers: [
    AiService,
    AuditLogService,
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
  ],
})
export class AiModule {}

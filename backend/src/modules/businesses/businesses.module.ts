import { Module } from '@nestjs/common';
import { DomainsModule } from '@/modules/domains/domains.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [DomainsModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  // Экспортирован для AI-4 (conversational onboarding, AI_PLATFORM_ROADMAP.md
  // §2.7) — `CreateBusinessTool` вызывает существующий `BusinessesService.
  // create`, а не дублирует логику создания бизнеса+сайта одной транзакцией.
  exports: [BusinessesService],
})
export class BusinessesModule {}

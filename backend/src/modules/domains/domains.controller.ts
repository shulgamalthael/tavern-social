import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { ConnectDomainDto } from './dto/connect-domain.dto';
import type { ConnectDomainResultDto, DnsInstructionDto, DomainDto } from './domains.types';
import { DomainsService } from './domains.service';

/** Владелец-only управление доменами бизнеса — вложено под businessId, тем
 * же принципом, что `WebsitesController` (см. AGENTS.md: сайт/домены не
 * существуют без бизнеса-владельца). Анонимное разрешение hostname → сайт —
 * отдельный, намеренно не защищённый контроллер, см. `PublicSitesController`
 * в `modules/public-sites`. */
@Controller('businesses/:businessId/domains')
@UseGuards(SessionAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<DomainDto[]> {
    return this.domainsService.list(businessId, currentUser.id);
  }

  @Post()
  connect(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: ConnectDomainDto,
  ): Promise<ConnectDomainResultDto> {
    return this.domainsService.connectCustomDomain(businessId, currentUser.id, dto.hostname);
  }

  @Get(':domainId/instructions')
  getInstructions(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
  ): Promise<DnsInstructionDto[]> {
    return this.domainsService.getInstructions(businessId, currentUser.id, domainId);
  }

  @Post(':domainId/verify')
  verify(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
  ): Promise<DomainDto> {
    return this.domainsService.verify(businessId, currentUser.id, domainId);
  }

  @Post(':domainId/primary')
  setPrimary(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
  ): Promise<DomainDto[]> {
    return this.domainsService.setPrimary(businessId, currentUser.id, domainId);
  }

  @Delete(':domainId')
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('domainId') domainId: string,
  ): Promise<DomainDto[]> {
    return this.domainsService.remove(businessId, currentUser.id, domainId);
  }
}

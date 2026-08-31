import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { Web3Service } from './web3.service';
import type { WalletInfoDto } from './web3.types';

/** Вложено под `/businesses/:businessId/web3`, тот же принцип, что у
 * `RulesController`/`DiscountsController` — владелец-only, read-only. */
@Controller('businesses/:businessId/web3')
@UseGuards(SessionAuthGuard)
export class Web3Controller {
  constructor(private readonly web3Service: Web3Service) {}

  @Get('wallet')
  getWallet(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<WalletInfoDto> {
    return this.web3Service.getWalletInfo(businessId, currentUser.id);
  }
}

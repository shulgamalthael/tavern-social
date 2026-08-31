import { Module } from '@nestjs/common';
import { AlchemyAdapter } from './alchemy-adapter.service';
import { Web3Controller } from './web3.controller';
import { Web3Provider } from './web3-provider';
import { Web3Service } from './web3.service';

/** Экспортирует `Web3Service` для AI-инструмента `get_wallet_info`
 * (`modules/ai`) — тот же приём, что `BusinessesModule` экспортирует
 * `BusinessesService` ради AI-4 onboarding (см. `AGENTS.md` backend §2). */
@Module({
  controllers: [Web3Controller],
  providers: [Web3Service, { provide: Web3Provider, useClass: AlchemyAdapter }],
  exports: [Web3Service],
})
export class Web3Module {}

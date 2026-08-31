import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Web3Service } from '@/modules/web3/web3.service';
import type { ToolContext, ToolDefinition } from '../ai.types';
import { ToolRegistryService } from './tool-registry.service';

type GetWalletInfoInput = Record<string, never>;

interface GetWalletInfoOutput {
  walletAddress: string | null;
  providerConfigured: boolean;
  balanceEth: string | null;
  nftCount: number;
  error: string | null;
}

/**
 * Read-only инструмент (AI_PLATFORM_ROADMAP.md §2.6, AI-7 первый
 * ограниченный слайс) — оборачивает `Web3Service.getWalletInfo`, тот же
 * сервис, что читает `Web3Controller` для дашборда, не дублирует логику.
 * `low` risk — ничего не мутирует, тот же принцип, что у `get_project_tree`/
 * `list_media_assets`. Никогда не запрашивает адрес у модели как аргумент
 * (нет `parameters`) — читает ТОЛЬКО кошелёк, уже сохранённый владельцем на
 * своём бизнесе (`ctx.businessId`), не произвольный адрес из чата: AI не
 * должен превращаться в общий block-explorer поверх чужих кошельков.
 */
@Injectable()
export class GetWalletInfoTool implements OnModuleInit {
  constructor(
    private readonly web3Service: Web3Service,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit(): void {
    const definition: ToolDefinition<GetWalletInfoInput, GetWalletInfoOutput> = {
      name: 'get_wallet_info',
      description:
        'Возвращает баланс (ETH) и количество NFT кошелька, который владелец указал для своего бизнеса. Не принимает аргументов. Если кошелёк не задан или Web3 не настроен — возвращает providerConfigured/walletAddress, по которым видно, что показывать нечего.',
      riskLevel: 'low',
      parameters: { type: 'object', properties: {}, required: [] },
      parseInput: (): GetWalletInfoInput => ({}),
      handler: async (_input, ctx: ToolContext): Promise<GetWalletInfoOutput> => {
        const info = await this.web3Service.getWalletInfo(ctx.businessId, ctx.actorId);
        return {
          walletAddress: info.walletAddress,
          providerConfigured: info.providerConfigured,
          balanceEth: info.balance?.balanceEth ?? null,
          nftCount: info.nfts.length,
          error: info.error,
        };
      },
    };

    this.toolRegistry.register(definition);
  }
}

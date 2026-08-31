import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Web3Provider } from './web3-provider';
import type { WalletInfoDto } from './web3.types';

/**
 * AI-7 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.6) —
 * read-only витрина баланса/NFT кошелька, который владелец сам указал для
 * своего бизнеса (`Business.web3WalletAddress`). Простой модуль без
 * вложенной owned-сущности — проверка владения инлайн (`AGENTS.md` backend
 * §3, тот же приём, что `DiscountsService`/`BillingService`), не через
 * `BusinessesService` (тот же принцип "billing не должен зависеть от
 * BusinessesModule ради одной проверки", применённый здесь один в один).
 *
 * Ключ — только собственный, бизнеса (§19.2) — `business.web3AlchemyApiKey`
 * передаётся в `Web3Provider` напрямую, платформенного fallback нет и не
 * было задумано: без своего ключа Web3-раздел просто показывает "нужен
 * ключ" (`providerConfigured: false`), а не тихо работает на чужом лимите.
 */
@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly web3Provider: Web3Provider,
  ) {}

  async getWalletInfo(businessId: string, ownerId: string): Promise<WalletInfoDto> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, web3WalletAddress: true, web3AlchemyApiKey: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');

    const apiKey = business.web3AlchemyApiKey;
    const providerConfigured = this.web3Provider.isConfigured(apiKey ?? undefined);
    const walletAddress = business.web3WalletAddress;

    if (!walletAddress || !apiKey) {
      return { walletAddress, providerConfigured, balance: null, nfts: [], error: null };
    }

    try {
      const [balance, nfts] = await Promise.all([
        this.web3Provider.getWalletBalance(walletAddress, apiKey),
        this.web3Provider.getNftHoldings(walletAddress, apiKey),
      ]);
      return { walletAddress, providerConfigured, balance, nfts, error: null };
    } catch (error) {
      // Не роняем весь запрос ради read-only виджета (ключ временно
      // невалиден, сеть Alchemy недоступна, адрес не резолвится) — тот же
      // принцип "не должен ронять реальный вызов", что у `RulesService.
      // evaluate`, просто здесь ошибка идёт в само DTO, а не в лог сбоку,
      // потому что вызывающий (дашборд/AI tool) должен её увидеть, не
      // проглотить молча.
      this.logger.warn(`Не удалось получить данные кошелька ${walletAddress}: ${String(error)}`);
      return {
        walletAddress,
        providerConfigured,
        balance: null,
        nfts: [],
        error: 'Не удалось получить данные кошелька — попробуйте позже',
      };
    }
  }
}

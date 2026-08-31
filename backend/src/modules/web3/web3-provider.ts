import type { NftHolding, WalletBalance } from './web3.types';

/**
 * Абстракция над Web3-провайдером (`AGENTS.md` backend §4 — тот же приём,
 * что `PaymentProvider`/`LlmProvider`) — `Web3Service` зависит только от
 * этого класса, не от Alchemy напрямую. Единственная реализация сегодня —
 * `AlchemyAdapter`. Только read-only операции (AI_PLATFORM_ROADMAP.md §2.6:
 * "wallet connection, balance read, NFT read, tx status — all read/display
 * operations first") — подпись и отправка транзакций сюда осознанно не
 * входят: та работа — client-side, кошельком самого пользователя
 * (wagmi/viem), backend/AI-слой её в принципе не должен уметь делать.
 */
export abstract class Web3Provider {
  /** `false`, если `ALCHEMY_API_KEY` не задан — вызывающий код показывает
   * "Web3 не настроен", не падает (тот же принцип, что у `StripeAdapter`). */
  abstract isConfigured(): boolean;

  abstract getWalletBalance(address: string): Promise<WalletBalance>;

  abstract getNftHoldings(address: string): Promise<NftHolding[]>;
}

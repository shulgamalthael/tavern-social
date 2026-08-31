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
 *
 * Ключ ВСЕГДА собственный, конкретного бизнеса (`Business.
 * web3AlchemyApiKey`) — платформа не хранит и не предоставляет общий ключ
 * ни для одного бизнеса (AI_PLATFORM_ROADMAP.md §19.2). `apiKey` поэтому
 * обязателен на read-методах — `Web3Service` вызывает их, только когда
 * ключ у бизнеса уже есть.
 */
export abstract class Web3Provider {
  /** `false`, если `apiKey` не передан/пуст — вызывающий код показывает
   * "нужен собственный ключ", не падает (тот же принцип, что у
   * `StripeAdapter`). */
  abstract isConfigured(apiKey: string | undefined): boolean;

  abstract getWalletBalance(address: string, apiKey: string): Promise<WalletBalance>;

  abstract getNftHoldings(address: string, apiKey: string): Promise<NftHolding[]>;
}

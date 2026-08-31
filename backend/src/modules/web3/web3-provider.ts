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
 * `apiKey?` на каждом методе — BYOK (bring your own key, AI_PLATFORM_
 * ROADMAP.md §19.1): бизнес может задать собственный `Business.
 * web3AlchemyApiKey` вместо (или в дополнение к) общему `ALCHEMY_API_KEY`
 * платформы. `undefined` — используется платформенный ключ по умолчанию,
 * тот же "необязательный override поверх дефолта" приём, что и везде в
 * проекте, где сначала появился один общий сценарий, а потом — per-tenant
 * вариант поверх него (например, `Business.currency` поверх глобального
 * дефолта валюты).
 */
export abstract class Web3Provider {
  /** `false`, если НИ переданный `apiKey`, НИ платформенный `ALCHEMY_API_KEY`
   * не заданы — вызывающий код показывает "Web3 не настроен", не падает
   * (тот же принцип, что у `StripeAdapter`). */
  abstract isConfigured(apiKey?: string): boolean;

  abstract getWalletBalance(address: string, apiKey?: string): Promise<WalletBalance>;

  abstract getNftHoldings(address: string, apiKey?: string): Promise<NftHolding[]>;
}

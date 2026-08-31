/** Зеркалит backend `WalletInfoDto` (`modules/web3/web3.types.ts`) —
 * read-only витрина баланса/NFT кошелька, который владелец сам указал для
 * своего бизнеса (AI_PLATFORM_ROADMAP.md §2.6, AI-7). Frontend/backend не
 * делят типы (разные TS-проекты, тот же принцип, что у `entities/business`). */
export interface WalletBalance {
  balanceWei: string;
  balanceEth: string;
}

export interface NftHolding {
  contractAddress: string;
  tokenId: string;
  name: string | null;
  imageUrl: string | null;
}

export interface WalletInfo {
  walletAddress: string | null;
  /** `false` — оператор платформы ещё не задал `ALCHEMY_API_KEY`, витрина
   * показывает «Web3 пока не настроен на платформе», а не форму ввода. */
  providerConfigured: boolean;
  balance: WalletBalance | null;
  nfts: NftHolding[];
  /** Непустая строка — адрес и провайдер оба настроены, но реальный запрос
   * к Alchemy упал (см. `Web3Service`'s комментарий на backend). */
  error: string | null;
}

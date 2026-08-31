/** Только Ethereum mainnet в этом слайсе (AI_PLATFORM_ROADMAP.md §2.6, AI-7
 * первый ограниченный слайс) — сеть задаётся один раз оператором через
 * `ALCHEMY_NETWORK` (см. `configuration.ts`), не per-business: мультисеть
 * никем не запрошена, добавлять её впрок было бы преждевременной
 * абстракцией (тот же принцип narrow-v1, что и у остального проекта). */
export interface WalletBalance {
  /** Сырое значение из `eth_getBalance`, wei в hex-строке — сохраняем как
   * есть для точности (JS `number` теряет точность на таких величинах),
   * `balanceEth` ниже — уже готовое для отображения человекочитаемое число. */
  balanceWei: string;
  balanceEth: string;
}

export interface NftHolding {
  contractAddress: string;
  tokenId: string;
  /** `null`, если Alchemy не вернул метаданные (незалитая коллекция,
   * повреждённый tokenURI и т. п.) — реальный, не гипотетический случай на
   * произвольных NFT из чужих контрактов. */
  name: string | null;
  imageUrl: string | null;
}

export interface WalletInfoDto {
  walletAddress: string | null;
  /** `false`, если у бизнеса не задан собственный API-ключ Alchemy
   * (`Business.web3AlchemyApiKey`, см. `AlchemyAdapter.isConfigured()`) —
   * платформа не подставляет свой ключ ни для одного бизнеса
   * (AI_PLATFORM_ROADMAP.md §19.2). Тот же приём, что у `PaymentProvider`/
   * `LlmProvider`: вызывающий код (здесь — frontend) показывает понятное
   * "нужен ключ", не получает голый 500. */
  providerConfigured: boolean;
  balance: WalletBalance | null;
  nfts: NftHolding[];
  /** Непустая строка, если адрес и провайдер оба настроены, но реальный
   * запрос к Alchemy упал (неверный ключ, сеть, невалидный формат ответа) —
   * отличаем "нечего показывать, потому что не настроено" от "должно было
   * сработать, но не получилось", не проваливаем весь запрос в 500 ради
   * read-only витрины. */
  error: string | null;
}

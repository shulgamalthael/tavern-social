import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@/config/configuration';
import { Web3Provider } from './web3-provider';
import type { NftHolding, WalletBalance } from './web3.types';

const WEI_PER_ETH = 10n ** 18n;

interface AlchemyJsonRpcResponse {
  result?: string;
  error?: { code: number; message: string };
}

interface AlchemyNftOwnedNft {
  contract: { address: string };
  tokenId: string;
  name?: string | null;
  image?: { cachedUrl?: string | null; originalUrl?: string | null } | null;
}

interface AlchemyNftsForOwnerResponse {
  ownedNfts?: AlchemyNftOwnedNft[];
}

/** Сколько максимум NFT показывать в read-only витрине — тот же
 * "мини"-лимит без пагинации, что у `PlanSelectionEventService`/
 * `AuditLogService`, дашборд-виджет, не полноценный explorer. */
const NFT_PAGE_SIZE = 25;

/** wei (hex-строка из `eth_getBalance`) → человекочитаемый ETH,
 * `BigInt`-арифметика — `Number()` теряет точность на величинах такого
 * порядка. Обрезает хвостовые нули дробной части, оставляет "0" для
 * пустого баланса, а не "0.000000000000000000". */
function formatWeiToEth(weiHex: string): string {
  const wei = BigInt(weiHex);
  const whole = wei / WEI_PER_ETH;
  const fraction = wei % WEI_PER_ETH;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionStr}`;
}

/**
 * Единственная реализация `Web3Provider` сегодня — прямой `fetch` к Alchemy
 * REST/JSON-RPC (тот же приём, что `GeminiAdapter`: не тянуть SDK ради
 * нескольких эндпоинтов, см. её комментарий). Баланс — стандартный Ethereum
 * JSON-RPC `eth_getBalance` через `https://{network}.g.alchemy.com/v2/{key}`;
 * NFT — фирменный REST-эндпоинт Alchemy NFT API v3 `getNFTsForOwner`
 * (`docs.alchemy.com/reference/getnftsforowner-v3`) — Ethereum сам по себе
 * не имеет стандартного JSON-RPC метода для перечисления NFT владельца,
 * это Alchemy-специфичное расширение поверх индексации.
 */
@Injectable()
export class AlchemyAdapter extends Web3Provider {
  private readonly logger = new Logger(AlchemyAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly network: string;

  constructor(configService: ConfigService) {
    super();
    const config = configService.get<AppConfig>('app')!;
    this.apiKey = config.alchemyApiKey;
    this.network = config.alchemyNetwork;

    if (!this.apiKey) {
      this.logger.warn('ALCHEMY_API_KEY не задан — Web3-раздел дашборда/get_wallet_info отключены');
    }
  }

  isConfigured(): boolean {
    return this.apiKey !== undefined;
  }

  private rpcUrl(): string {
    return `https://${this.network}.g.alchemy.com/v2/${this.apiKey}`;
  }

  private nftApiUrl(path: string): string {
    return `https://${this.network}.g.alchemy.com/nft/v3/${this.apiKey}/${path}`;
  }

  async getWalletBalance(address: string): Promise<WalletBalance> {
    if (!this.apiKey) {
      throw new Error('Alchemy не настроен — вызывающий код обязан проверить isConfigured()');
    }

    const response = await fetch(this.rpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    const body = (await response.json()) as AlchemyJsonRpcResponse;
    if (!response.ok || body.error || !body.result) {
      throw new Error(body.error?.message ?? `Alchemy eth_getBalance вернул ${response.status}`);
    }

    return { balanceWei: BigInt(body.result).toString(), balanceEth: formatWeiToEth(body.result) };
  }

  async getNftHoldings(address: string): Promise<NftHolding[]> {
    if (!this.apiKey) {
      throw new Error('Alchemy не настроен — вызывающий код обязан проверить isConfigured()');
    }

    const url = new URL(this.nftApiUrl('getNFTsForOwner'));
    url.searchParams.set('owner', address);
    url.searchParams.set('withMetadata', 'true');
    url.searchParams.set('pageSize', String(NFT_PAGE_SIZE));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alchemy getNFTsForOwner вернул ${response.status}`);
    }

    const body = (await response.json()) as AlchemyNftsForOwnerResponse;
    return (body.ownedNfts ?? []).map((nft) => ({
      contractAddress: nft.contract.address,
      tokenId: nft.tokenId,
      name: nft.name ?? null,
      imageUrl: nft.image?.cachedUrl ?? nft.image?.originalUrl ?? null,
    }));
  }
}

'use client';

import { useCallback } from 'react';
import { getPublicWalletInfo, type WalletInfo } from '@/entities/web3';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { ImageIcon, WalletIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { SectionHeading } from '../shared/SectionHeading';
import primitives from '../shared/primitives.module.scss';
import styles from './web3.module.scss';

// --- Web3Wallet --------------------------------------------------------
// Публичная витрина баланса/NFT кошелька, который владелец указал в
// разделе «Web3» дашборда (AI_PLATFORM_ROADMAP.md §2.6/§19, AI-7) — тот же
// принцип, что и `productgrid`/`servicegrid`: не хранит данные кошелька в
// своих `props` (нечего было бы там хранить и синхронизировать — баланс/
// NFT меняются в реальном блокчейне независимо от сайта), дозагружает их
// заново при каждом рендере через по-настоящему анонимный
// `getPublicWalletInfo` (AI_PLATFORM_ROADMAP.md §26, AI-13). Владелец сам
// решает, добавлять ли этот блок на сайт — адрес кошелька публичен по
// своей природе (виден в любом блокчейн-эксплорере), а API-ключ Alchemy
// используется только на backend и наружу никогда не уходит (см.
// `Web3Service.getWalletInfoPublic`).

interface Web3WalletProps {
  eyebrow: string;
  heading: string;
  description: string;
  nftLimit: number;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Web3WalletRenderer({ props, business }: BlockRendererProps<Web3WalletProps>) {
  const fetcher = useCallback(
    () => getPublicWalletInfo(business.businessId),
    [business.businessId],
  );
  const { status, data, error } = useAsyncData<WalletInfo>(fetcher);

  if (status === 'loading') {
    return (
      <div className={styles.placeholder}>
        <WalletIcon />
        <span>Загружаем данные кошелька…</span>
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.placeholder}>
        <WalletIcon />
        <span>{error ?? 'Не удалось загрузить данные кошелька'}</span>
      </div>
    );
  }

  if (!data.walletAddress) {
    return (
      <div className={styles.placeholder}>
        <WalletIcon />
        <span>
          Кошелёк ещё не подключён — владелец может указать адрес в разделе «Web3» дашборда.
        </span>
      </div>
    );
  }

  if (!data.providerConfigured) {
    return (
      <div className={styles.placeholder}>
        <WalletIcon />
        <span>
          Нужен API-ключ Alchemy, чтобы показать баланс и NFT — владелец может добавить его в
          разделе «Web3» дашборда.
        </span>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className={styles.placeholder}>
        <WalletIcon />
        <span>{data.error}</span>
      </div>
    );
  }

  const nfts = data.nfts.slice(0, props.nftLimit);

  return (
    <div className={primitives.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
      />

      <div className={styles.address}>
        <WalletIcon />
        <span>{shortenAddress(data.walletAddress)}</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.stat__value}>{data.balance?.balanceEth ?? '0'} ETH</span>
          <span className={styles.stat__label}>Баланс</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.stat__value}>{data.nfts.length}</span>
          <span className={styles.stat__label}>NFT</span>
        </div>
      </div>

      {nfts.length > 0 && (
        <div
          className={primitives['simple-grid']}
          style={{ '--grid-columns': 3 } as React.CSSProperties}
        >
          {nfts.map((nft) => (
            <div
              key={`${nft.contractAddress}-${nft.tokenId}`}
              className={primitives['simple-card']}
            >
              {nft.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- внешний, непредсказуемый по домену URL NFT-медиа (IPFS-гейтвеи, CDN коллекций)
                <img
                  src={nft.imageUrl}
                  alt={nft.name ?? `NFT #${nft.tokenId}`}
                  className={styles['nft-card__image']}
                />
              ) : (
                <div className={styles['nft-card__no-image']}>
                  <ImageIcon />
                </div>
              )}
              <div className={styles['nft-card__body']}>
                <p className={styles['nft-card__name']}>
                  {nft.name ?? `#${nft.tokenId.slice(0, 8)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const web3WalletFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  { key: 'nftLimit', label: 'Сколько NFT показывать', control: 'number', min: 0, max: 24 },
];

registerBlock<Web3WalletProps>({
  type: 'web3wallet',
  label: 'Кошелёк Web3',
  category: 'business',
  icon: WalletIcon,
  description: 'Баланс и NFT кошелька из раздела «Web3» дашборда',
  defaultProps: {
    eyebrow: 'WEB3',
    heading: 'Наш кошелёк',
    description: '',
    nftLimit: 6,
  },
  fields: web3WalletFields,
  Renderer: Web3WalletRenderer,
});

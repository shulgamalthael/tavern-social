'use client';

import { useCallback, useState } from 'react';
import { updateBusiness, type Business } from '@/entities/business';
import { getWalletInfo } from '@/entities/web3';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { EditIcon, ImageIcon, WalletIcon } from '@/shared/ui/icons';
import styles from './Web3Section.module.scss';

export interface Web3SectionProps {
  business: Business;
  onWalletChanged: () => void;
}

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * AI-7 первый ограниченный слайс (AI_PLATFORM_ROADMAP.md §2.6) — read-only
 * витрина баланса/NFT СОБСТВЕННОГО кошелька владельца бизнеса, не форма
 * приёма крипто-платежей от покупателей (та работа — client-side
 * wallet-signed подтверждение через wagmi/viem, осознанно вне этого
 * слайса, см. §2.6). Адрес хранится прямо на `Business` (`updateBusiness`),
 * отдельного CRUD под него не заводим — одно nullable-поле, тот же принцип,
 * что у остальных настроек бизнеса (email/phone/address).
 */
export function Web3Section({ business, onWalletChanged }: Web3SectionProps) {
  const fetcher = useCallback(() => getWalletInfo(business.id), [business.id]);
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const [isEditing, setEditing] = useState(false);
  const [addressInput, setAddressInput] = useState(business.web3WalletAddress ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = addressInput.trim();
    if (trimmed !== '' && !ADDRESS_PATTERN.test(trimmed)) {
      setSaveError('Адрес должен быть в формате 0x + 40 hex-символов');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateBusiness(business.id, { web3WalletAddress: trimmed });
      setEditing(false);
      onWalletChanged();
      await refetch();
    } catch {
      setSaveError('Не удалось сохранить адрес — попробуйте ещё раз');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем кошелёк…" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (isEditing || !data.walletAddress) {
    return (
      <div className={styles.root}>
        <form className={styles.form} onSubmit={(event) => void handleSave(event)}>
          <label className={styles.field}>
            <span className={styles.label}>Адрес кошелька (Ethereum)</span>
            <input
              type="text"
              className={styles.input}
              placeholder="0x..."
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
            />
          </label>
          <p className={styles.hint}>
            Только для отображения — баланс и NFT этого адреса будут видны здесь и AI-ассистенту
            (инструмент get_wallet_info). Платформа никогда не подписывает и не отправляет
            транзакции от вашего имени.
          </p>
          {saveError && (
            <p className={styles.error} role="alert">
              {saveError}
            </p>
          )}
          <div className={styles.actions}>
            {data.walletAddress && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddressInput(data.walletAddress ?? '');
                  setSaveError(null);
                  setEditing(false);
                }}
              >
                Отмена
              </Button>
            )}
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.address}>
          <WalletIcon />
          <span>{shortenAddress(data.walletAddress)}</span>
        </div>
        <button
          type="button"
          className={styles.editButton}
          aria-label="Изменить адрес кошелька"
          onClick={() => setEditing(true)}
        >
          <EditIcon />
        </button>
      </div>

      {!data.providerConfigured ? (
        <EmptyState
          title="Web3 пока не настроен на платформе"
          description="Администратор ещё не подключил провайдера (Alchemy) — баланс и NFT появятся здесь автоматически, как только это будет сделано."
        />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={refetch} />
      ) : (
        <>
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

          {data.nfts.length === 0 ? (
            <EmptyState
              title="NFT не найдены"
              description="На этом кошельке пока нет ни одного NFT на выбранной сети."
            />
          ) : (
            <ul className={styles.nftGrid}>
              {data.nfts.map((nft) => (
                <li key={`${nft.contractAddress}-${nft.tokenId}`} className={styles.nftCard}>
                  {nft.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- внешний, непредсказуемый по домену URL NFT-медиа (IPFS-гейтвеи, CDN коллекций) — next/image требует заранее известный allowlist доменов, несовместимо с произвольными NFT-контрактами.
                    <img
                      src={nft.imageUrl}
                      alt={nft.name ?? `NFT #${nft.tokenId}`}
                      className={styles.nftCard__image}
                    />
                  ) : (
                    <div className={styles.nftCard__placeholder}>
                      <ImageIcon />
                    </div>
                  )}
                  <span className={styles.nftCard__name}>
                    {nft.name ?? `#${nft.tokenId.slice(0, 8)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

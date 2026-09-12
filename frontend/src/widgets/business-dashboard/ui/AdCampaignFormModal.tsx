'use client';

import { useCallback, useState, type FormEvent } from 'react';
import {
  AD_BILLING_MODEL_LABELS,
  AD_PLACEMENT_LABELS,
  createAdCampaign,
  getPlacementInsights,
  type AdBillingModel,
  type AdPlacement,
  type PlacementInsight,
} from '@/entities/advertising';
import { BUSINESS_CATEGORIES, type BusinessCategory } from '@/entities/business';
import { getCurrencyMetadata } from '@/shared/config/currencies';
import { formatMoney, toMinorUnits } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import checkboxStyles from './AdCampaignFormModal.module.scss';
import formStyles from './ProductFormModal.module.scss';

export interface AdCampaignFormModalProps {
  businessId: string;
  currency: string;
  onSaved: () => void;
  onClose: () => void;
}

const ALL_PLACEMENTS: AdPlacement[] = [
  'header',
  'content',
  'sidebar',
  'footer',
  'in_feed',
  'feed_sidebar',
];
const ALL_DEVICES: ('desktop' | 'tablet' | 'mobile')[] = ['desktop', 'tablet', 'mobile'];
const DEVICE_LABELS: Record<'desktop' | 'tablet' | 'mobile', string> = {
  desktop: 'Десктоп',
  tablet: 'Планшет',
  mobile: 'Мобильный',
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Создание — единственная операция над кампанией здесь: backend не даёт
 * `PATCH` (см. `AdCampaignsController`) — редактируются только креативы, и
 * только пока кампания в статусе `draft` (`AdCreativeFormModal`), сама
 * кампания после создания неизменяема. */
export function AdCampaignFormModal({
  businessId,
  currency,
  onSaved,
  onClose,
}: AdCampaignFormModalProps) {
  const currencyMetadata = getCurrencyMetadata(currency);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [billingModel, setBillingModel] = useState<AdBillingModel>('cpm');
  const [bid, setBid] = useState('');
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [devices, setDevices] = useState<('desktop' | 'tablet' | 'mobile')[]>([]);
  const [countriesInput, setCountriesInput] = useState('');
  const [isAdultContent, setAdultContent] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlacementInsights = useCallback(() => getPlacementInsights(businessId), [businessId]);
  // Подсказка необязательна для создания кампании — при `loading`/`error`
  // просто не рендерим панель (см. ниже), не блокируем форму.
  const placementInsights = useAsyncData(fetchPlacementInsights);
  const insights = placementInsights.data ?? [];
  const popularPlacements = [...insights]
    .sort((a, b) => b.activeCampaignCount - a.activeCampaignCount)
    .slice(0, 3);
  const freePlacements = [...insights]
    .sort((a, b) => a.activeCampaignCount - b.activeCampaignCount)
    .slice(0, 3);

  // `avgEffectiveCpmUsdCents` уже приведён backend'ом к USD (см. её
  // комментарий в `entities/advertising`) — здесь просто форматируем, без
  // какой-либо конвертации. `null` — курсы валют сейчас недоступны либо на
  // месте нет ни одной конвертируемой кампании (не значит "мест нет
  // вовсе" — счётчик кампаний это уже показывает отдельно).
  function formatInsightChipLabel(insight: PlacementInsight): string {
    const base = `${AD_PLACEMENT_LABELS[insight.placement]} · ${insight.activeCampaignCount}`;
    if (insight.avgEffectiveCpmUsdCents === null) return base;
    return `${base} · ~${formatMoney(insight.avgEffectiveCpmUsdCents, 'USD')} eCPM`;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Введите название кампании');
      return;
    }
    const budgetCents = toMinorUnits(budget, currency);
    if (budgetCents === null || budgetCents < 100) {
      setError('Введите бюджет, минимум $1 (эквивалент в вашей валюте)');
      return;
    }
    const bidCents = toMinorUnits(bid, currency);
    if (bidCents === null || bidCents < 1) {
      setError('Введите ставку больше 0');
      return;
    }
    if (placements.length === 0) {
      setError('Выберите хотя бы одно место размещения');
      return;
    }
    // ISO 3166-1 alpha-2 — та же проверка формата, что и backend
    // `CreateAdCampaignDto.targetCountries` (`@Matches(/^[A-Z]{2}$/)`) —
    // лучше сказать об ошибке здесь понятным текстом, чем отдать её как
    // сырую 400 от backend. Дедуп через `Set` ДО отправки — backend
    // отдельно требует `@ArrayUnique()`; "US, us" — очевидно один и тот же
    // код с точки зрения пользователя, тихо схлопнуть его в один лучше,
    // чем заставлять чинить "дубликат" самому.
    const countries = [
      ...new Set(
        countriesInput
          .split(',')
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (countries.some((code) => !/^[A-Z]{2}$/.test(code))) {
      setError('Код страны должен быть из двух латинских букв (например, US, UA) через запятую');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createAdCampaign(businessId, {
        name: name.trim(),
        budgetCents,
        billingModel,
        bidCents,
        targetPlacements: placements,
        targetCategories: categories.length > 0 ? categories : undefined,
        targetDevices: devices.length > 0 ? devices : undefined,
        targetCountries: countries.length > 0 ? countries : undefined,
        isAdultContent,
        startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать кампанию');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} label="Новая рекламная кампания" className={formStyles.modal}>
      <h2 className={formStyles.title}>Новая рекламная кампания</h2>

      <form className={formStyles.form} onSubmit={(event) => void onSubmit(event)}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Название кампании</span>
          <input
            type="text"
            className={formStyles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Летняя распродажа"
            autoFocus
          />
        </label>

        <div className={checkboxStyles.row}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>
              Бюджет, {currencyMetadata.symbol} ({currencyMetadata.code})
            </span>
            <input
              type="text"
              inputMode="decimal"
              className={formStyles.input}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="1000"
            />
          </label>

          <label className={formStyles.field}>
            <span className={formStyles.label}>Модель оплаты</span>
            <select
              className={formStyles.input}
              value={billingModel}
              onChange={(event) => setBillingModel(event.target.value as AdBillingModel)}
            >
              {(Object.entries(AD_BILLING_MODEL_LABELS) as [AdBillingModel, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <label className={formStyles.field}>
          <span className={formStyles.label}>
            {billingModel === 'cpm'
              ? `Ставка за 1000 показов, ${currencyMetadata.symbol}`
              : `Ставка за клик, ${currencyMetadata.symbol}`}
          </span>
          <input
            type="text"
            inputMode="decimal"
            className={formStyles.input}
            value={bid}
            onChange={(event) => setBid(event.target.value)}
            placeholder={billingModel === 'cpm' ? '50' : '5'}
          />
        </label>

        {placementInsights.status === 'success' && insights.length > 0 && (
          <div className={checkboxStyles.insights}>
            <div className={checkboxStyles['insights__column']}>
              <span className={checkboxStyles['insights__title']}>🔥 Популярные сейчас</span>
              <div className={checkboxStyles.checkboxGroup}>
                {popularPlacements.map((insight) => (
                  <Button
                    key={insight.placement}
                    type="button"
                    variant={placements.includes(insight.placement) ? 'primary' : 'chip'}
                    onClick={() => setPlacements((prev) => toggle(prev, insight.placement))}
                  >
                    {formatInsightChipLabel(insight)}
                  </Button>
                ))}
              </div>
            </div>
            <div className={checkboxStyles['insights__column']}>
              <span className={checkboxStyles['insights__title']}>✨ Свободные сейчас</span>
              <div className={checkboxStyles.checkboxGroup}>
                {freePlacements.map((insight) => (
                  <Button
                    key={insight.placement}
                    type="button"
                    variant={placements.includes(insight.placement) ? 'primary' : 'chip'}
                    onClick={() => setPlacements((prev) => toggle(prev, insight.placement))}
                  >
                    {formatInsightChipLabel(insight)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={formStyles.field}>
          <span className={formStyles.label}>Места размещения</span>
          <div className={checkboxStyles.checkboxGroup}>
            {ALL_PLACEMENTS.map((placement) => (
              <label key={placement} className={checkboxStyles.checkboxOption}>
                <input
                  type="checkbox"
                  checked={placements.includes(placement)}
                  onChange={() => setPlacements((prev) => toggle(prev, placement))}
                />
                {AD_PLACEMENT_LABELS[placement]}
              </label>
            ))}
          </div>
        </div>

        <div className={formStyles.field}>
          <span className={formStyles.label}>
            Категории публикаторов (пусто — показывать на любой категории)
          </span>
          <div className={checkboxStyles.checkboxGroup}>
            {BUSINESS_CATEGORIES.map((category) => (
              <label key={category.id} className={checkboxStyles.checkboxOption}>
                <input
                  type="checkbox"
                  checked={categories.includes(category.id)}
                  onChange={() => setCategories((prev) => toggle(prev, category.id))}
                />
                {category.label}
              </label>
            ))}
          </div>
        </div>

        <div className={formStyles.field}>
          <span className={formStyles.label}>
            Устройства (пусто — показывать на любом устройстве)
          </span>
          <div className={checkboxStyles.checkboxGroup}>
            {ALL_DEVICES.map((device) => (
              <label key={device} className={checkboxStyles.checkboxOption}>
                <input
                  type="checkbox"
                  checked={devices.includes(device)}
                  onChange={() => setDevices((prev) => toggle(prev, device))}
                />
                {DEVICE_LABELS[device]}
              </label>
            ))}
          </div>
        </div>

        <label className={formStyles.field}>
          <span className={formStyles.label}>
            Страны показа (необязательно, коды через запятую — например, US, UA)
          </span>
          <input
            type="text"
            className={formStyles.input}
            value={countriesInput}
            onChange={(event) => setCountriesInput(event.target.value)}
            placeholder="Пусто — показывать в любой стране"
          />
        </label>

        <label className={checkboxStyles.checkboxOption}>
          <input
            type="checkbox"
            checked={isAdultContent}
            onChange={(event) => setAdultContent(event.target.checked)}
          />
          Рекламирует товары/услуги 18+
        </label>

        <div className={checkboxStyles.row}>
          <label className={formStyles.field}>
            <span className={formStyles.label}>Начало показа (необязательно)</span>
            <input
              type="date"
              className={formStyles.input}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label className={formStyles.field}>
            <span className={formStyles.label}>Окончание показа (необязательно)</span>
            <input
              type="date"
              className={formStyles.input}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Создаём…' : 'Создать черновик'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createIdentitySession,
  getCreatorCategories,
  getCreatorEligibility,
  getMyCreatorProfile,
  MAX_ADDITIONAL_CATEGORIES,
  startCreatorOnboarding,
  type CreatorCategoryNode,
} from '@/entities/creator';
import { getStripe } from '@/shared/lib/stripe-client';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './CreatorOnboardingWidget.module.scss';

const PIPELINE_STEPS = [
  'Создавайте контент',
  'Мы анализируем вашу аудиторию',
  'Находим подходящие бренды',
  'Бизнес оплачивает размещение',
  'Реклама появляется в вашем контенте',
  'Вы получаете доход',
];

type Step = 'benefits' | 'categories' | 'identity';

function CategoryOption({
  node,
  depth,
  isSelected,
  isDisabled,
  onSelect,
}: {
  node: CreatorCategoryNode;
  depth: number;
  isSelected: (id: string) => boolean;
  isDisabled: (id: string) => boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        className={styles['categories__option']}
        style={{ paddingLeft: 12 + depth * 16 }}
        aria-pressed={isSelected(node.id)}
        disabled={isDisabled(node.id)}
        onClick={() => onSelect(node.id)}
      >
        {node.icon && <span aria-hidden="true">{node.icon}</span>}
        {node.label}
      </button>
      {node.children.map((child) => (
        <CategoryOption
          key={child.id}
          node={child}
          depth={depth + 1}
          isSelected={isSelected}
          isDisabled={isDisabled}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

/**
 * "Стать блогером" (AI_PLATFORM_ROADMAP.md §79) — благодарности → выбор
 * категории → верификация Stripe Identity → ожидание. Тот же "тонкий,
 * однонаправленный flow" принцип, что `AdvertiserSignupFlow`
 * (`widgets/businesses`), просто с бОльшим числом шагов — они здесь
 * реальные, не вырезаны искусственно.
 */
export function CreatorOnboardingWidget() {
  const router = useRouter();
  // Локальный шаг — только для ручной навигации нового пользователя
  // (`benefits` → `categories` → `identity`), пока `CreatorProfile` ещё не
  // создан. Как только профиль появляется (уже начали раньше), реальный
  // отображаемый шаг вычисляется из данных ниже (`step`, производное
  // значение), а не переключается отдельным `setState` в эффекте.
  const [localStep, setLocalStep] = useState<Step>('benefits');
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [identityStarted, setIdentityStarted] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  const eligibilityFetcher = useCallback(() => getCreatorEligibility(), []);
  const eligibility = useAsyncData(eligibilityFetcher);

  const categoriesFetcher = useCallback(() => getCreatorCategories(), []);
  const categories = useAsyncData(categoriesFetcher);

  const profileFetcher = useCallback(() => getMyCreatorProfile(), []);
  const profile = useAsyncData(profileFetcher);

  // Редирект — синхронизация с внешней системой (роутер), не наше
  // собственное состояние, поэтому легитимен внутри эффекта.
  useEffect(() => {
    if (profile.data?.status === 'active') router.push('/creator/studio');
  }, [profile.data, router]);

  const step: Step = profile.data && profile.data.status !== 'active' ? 'identity' : localStep;

  async function handleSelectCategories() {
    if (!primaryCategoryId) {
      setError('Выберите основную категорию');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await startCreatorOnboarding({ primaryCategoryId, additionalCategoryIds });
      setLocalStep('identity');
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Не удалось начать регистрацию',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartVerification() {
    setIdentityStarted(true);
    setIdentityError(null);
    try {
      const { clientSecret } = await createIdentitySession();
      const stripe = await getStripe();
      if (!stripe) {
        setIdentityError('Верификация временно недоступна — Stripe не настроен');
        return;
      }
      const { error: verifyError } = await stripe.verifyIdentity(clientSecret);
      if (verifyError) {
        setIdentityError(verifyError.message ?? 'Не удалось пройти верификацию');
      }
    } catch (submitError) {
      setIdentityError(
        submitError instanceof Error ? submitError.message : 'Не удалось начать верификацию',
      );
    } finally {
      setIdentityStarted(false);
    }
  }

  function toggleAdditional(id: string) {
    setAdditionalCategoryIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id);
      if (prev.length >= MAX_ADDITIONAL_CATEGORIES) return prev;
      return [...prev, id];
    });
  }

  if (eligibility.status === 'loading' || profile.status === 'loading') {
    return (
      <SectionContainer narrow>
        <Loader label="Загрузка…" />
      </SectionContainer>
    );
  }

  if (eligibility.status === 'error') {
    return (
      <SectionContainer narrow>
        <ErrorState message={eligibility.error} onRetry={eligibility.refetch} />
      </SectionContainer>
    );
  }

  if (eligibility.data && !eligibility.data.eligible && !profile.data) {
    return (
      <SectionContainer narrow>
        <PageHead title="Ещё немного до монетизации" />
        <p className={styles.locked}>
          Чтобы стать блогером и получать предложения от рекламодателей, вам необходимо иметь
          минимум {eligibility.data.requiredSubscribers.toLocaleString('ru-RU')} подписчиков.
        </p>
        <p className={styles['locked__progress']}>
          {eligibility.data.subscriberCount.toLocaleString('ru-RU')} /{' '}
          {eligibility.data.requiredSubscribers.toLocaleString('ru-RU')} подписчиков
        </p>
        <p className={styles.hint}>Продолжайте создавать контент и развивать свою аудиторию.</p>
      </SectionContainer>
    );
  }

  return (
    <SectionContainer narrow>
      {step === 'benefits' && (
        <div className={styles.step}>
          <PageHead
            title="Ваша аудитория может приносить вам доход"
            description="Мы сами находим бренды, которым интересна ваша аудитория — вам не нужно искать рекламодателей самостоятельно."
          />
          <ol className={styles.pipeline}>
            {PIPELINE_STEPS.map((label, index) => (
              <li key={label} className={styles['pipeline__item']}>
                <span className={styles['pipeline__index']}>{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <Button fullWidth onClick={() => setLocalStep('categories')}>
            Стать блогером
          </Button>
        </div>
      )}

      {step === 'categories' && (
        <div className={styles.step}>
          <PageHead
            title="Выберите категорию вашей деятельности"
            description={`Основная категория обязательна. Дополнительно можно выбрать до ${MAX_ADDITIONAL_CATEGORIES}.`}
          />

          {categories.status === 'loading' && <Loader label="Загрузка категорий…" />}
          {categories.status === 'error' && (
            <ErrorState message={categories.error} onRetry={categories.refetch} />
          )}
          {categories.status === 'success' && categories.data && (
            <>
              <p className={styles['categories__label']}>Основная категория</p>
              <div className={styles['categories__list']}>
                {categories.data.map((node) => (
                  <CategoryOption
                    key={node.id}
                    node={node}
                    depth={0}
                    isSelected={(id) => id === primaryCategoryId}
                    isDisabled={() => false}
                    onSelect={(id) => {
                      setPrimaryCategoryId(id);
                      setAdditionalCategoryIds((prev) =>
                        prev.filter((existing) => existing !== id),
                      );
                    }}
                  />
                ))}
              </div>

              <p className={styles['categories__label']}>
                Дополнительные категории ({additionalCategoryIds.length}/{MAX_ADDITIONAL_CATEGORIES}
                )
              </p>
              <div className={styles['categories__list']}>
                {categories.data.map((node) => (
                  <CategoryOption
                    key={node.id}
                    node={node}
                    depth={0}
                    isSelected={(id) => additionalCategoryIds.includes(id)}
                    isDisabled={(id) =>
                      id === primaryCategoryId ||
                      (additionalCategoryIds.length >= MAX_ADDITIONAL_CATEGORIES &&
                        !additionalCategoryIds.includes(id))
                    }
                    onSelect={toggleAdditional}
                  />
                ))}
              </div>
            </>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <Button fullWidth disabled={isSubmitting} onClick={() => void handleSelectCategories()}>
            {isSubmitting ? 'Сохраняем…' : 'Продолжить'}
          </Button>
        </div>
      )}

      {step === 'identity' && (
        <div className={styles.step}>
          <PageHead
            title="Подтвердите личность"
            description="Мы используем Stripe Identity — документ и селфи никогда не попадают на серверы Таверны, только результат проверки."
          />
          {profile.data?.status === 'rejected' && profile.data.rejectionReason && (
            <p className={styles.error} role="alert">
              Предыдущая попытка не пройдена: {profile.data.rejectionReason}
            </p>
          )}
          {identityError && (
            <p className={styles.error} role="alert">
              {identityError}
            </p>
          )}
          <Button
            fullWidth
            disabled={identityStarted}
            onClick={() => void handleStartVerification()}
          >
            {identityStarted ? 'Открываем Stripe…' : 'Подтвердить личность'}
          </Button>
          <Button variant="outline" fullWidth onClick={() => void profile.refetch()}>
            Проверить статус
          </Button>
        </div>
      )}
    </SectionContainer>
  );
}

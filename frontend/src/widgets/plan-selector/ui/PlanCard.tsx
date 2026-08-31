import type { PlanCardConfig } from '@/entities/subscription';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { CheckIcon, MegaphoneIcon, ShoppingBagIcon } from '@/shared/ui/icons';
import { GrowthStrategyPanel } from './GrowthStrategyPanel';
import styles from './PlanCard.module.scss';

export interface PlanCardProps {
  config: PlanCardConfig;
  isCurrent: boolean;
  /** Владелец уже платит за другой тариф — эта карточка меняет цену
   * существующей Stripe-подписки, а не открывает новый чекаут (см.
   * `BillingService.selectPlan`). Только влияет на подпись кнопки — сама
   * логика решается на backend. */
  isSwitch: boolean;
  isLoading: boolean;
  disabled: boolean;
  enterpriseInquirySent: boolean;
  onSelect: () => void;
}

/** Одна карточка тарифа — Free выделена акцентной рамкой и отдельным
 * пояснением "что уже бесплатно / что даст подписка" (см. философию §1/§16
 * исходного brief'а: Free не должен ощущаться обрезанной демкой), Business
 * получает бейдж "MOST_POPULAR", Enterprise — кнопку "Связаться с нами"
 * вместо чекаута. */
export function PlanCard({
  config,
  isCurrent,
  isSwitch,
  isLoading,
  disabled,
  enterpriseInquirySent,
  onSelect,
}: PlanCardProps) {
  return (
    <Card
      className={cn(
        styles.card,
        config.isFree && styles['card--free'],
        config.badge === 'MOST_POPULAR' && styles['card--popular'],
      )}
    >
      {config.badge === 'MOST_POPULAR' && (
        <Badge variant="accent" className={styles.card__ribbon}>
          Самый популярный
        </Badge>
      )}

      <h3 className={styles.card__name}>{config.name}</h3>
      <p className={styles.card__tagline}>{config.tagline}</p>
      <p className={styles.card__price}>{config.priceLabel}</p>

      <ul className={styles.card__bullets}>
        {config.bullets.map((bullet) => (
          <li key={bullet} className={styles.card__bullet}>
            <CheckIcon />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {config.isFree && (
        <p className={styles.card__freeNote}>
          Всё выше — бесплатно и без ограничения по времени. Платная подписка добавляет возможности
          сверху, не отбирает то, что уже доступно.
        </p>
      )}

      <div className={styles.card__monetization}>
        <p className={styles.card__adNote}>
          <ShoppingBagIcon />
          <span>{config.commerceNote}</span>
        </p>
        <p className={styles.card__adNote}>
          <MegaphoneIcon />
          <span>{config.adNote}</span>
        </p>
      </div>

      <div className={styles.card__divider} />
      <GrowthStrategyPanel strategy={config.growthStrategy} />

      <div className={styles.card__action}>
        {isCurrent ? (
          <Button variant="soft" fullWidth disabled>
            Текущий тариф
          </Button>
        ) : config.isEnterprise ? (
          <Button variant="outline" fullWidth onClick={onSelect} disabled={disabled || isLoading}>
            {enterpriseInquirySent ? 'Заявка отправлена' : 'Связаться с нами'}
          </Button>
        ) : (
          <Button
            variant={config.isFree ? 'outline' : 'primary'}
            fullWidth
            onClick={onSelect}
            disabled={disabled}
          >
            {isLoading
              ? 'Секунду…'
              : config.isFree
                ? isSwitch
                  ? 'Перейти на Free'
                  : 'Начать бесплатно'
                : isSwitch
                  ? 'Сменить тариф'
                  : 'Оформить подписку'}
          </Button>
        )}
      </div>
    </Card>
  );
}

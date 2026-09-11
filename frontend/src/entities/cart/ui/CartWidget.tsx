'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  DISCOUNT_REJECTION_LABELS,
  previewCoupon,
  type CouponPreviewResult,
} from '@/entities/discount';
import {
  createOrder,
  PAYMENT_UNAVAILABLE_REASON_LABELS,
  type CreateOrderResult,
  type PaymentUnavailableReason,
} from '@/entities/order';
import { DEFAULT_BUSINESS_CURRENCY } from '@/shared/config/currencies';
import { formatMoney } from '@/shared/lib/format-money';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { StripePaymentForm } from '@/shared/ui/StripePaymentForm';
import { CloseIcon, MinusIcon, PlusIcon, ShoppingBagIcon, TrashIcon } from '@/shared/ui/icons';
import { selectCartItemCount, selectCartTotalCents, useCartStore } from '../model/cart-store';
import styles from './CartWidget.module.scss';

export interface CartWidgetProps {
  businessId: string;
  /** Не рендерить собственный плавающий `.fab` — сайт уже даёт способ
   * открыть корзину из шапки (`HeaderActions.tsx`, кнопка `actions.cart`,
   * вызывает `useCartStore.open()` напрямую), второй одновременно видимый
   * триггер был бы лишним. Сама модалка оформления заказа продолжает
   * рендериться этим же компонентом независимо от источника открытия — обе
   * кнопки открывают ровно один и тот же стор-флаг `isOpen`. */
  hideFab?: boolean;
}

type Step = 'cart' | 'checkout' | 'payment' | 'payment-unavailable' | 'success';

/**
 * Глобальная плавающая корзина — монтируется один раз на весь публичный
 * сайт (см. `PublicSiteWidget`/`BusinessPageWidget`), не как блок, который
 * нужно перетащить на КАЖДУЮ страницу вручную: посетитель должен видеть
 * иконку корзины и мочь оформить заказ с любой страницы сайта, а не только
 * с той, куда владелец случайно вспомнил её добавить (тот же принцип, что у
 * навигации/темы — глобальная часть сайта, не содержимое конкретной
 * страницы). Виден только когда у бизнеса включена капабилити `commerce`
 * (см. вызывающий код) — на остальных сайтах не показывается вообще.
 *
 * Оплата — через Stripe Payment Element (см. `PaymentForm` выше), если у
 * бизнеса настроен Stripe (`createOrder` вернул `clientSecret` — см.
 * `OrdersService.createFromCart`); если нет — заказ остаётся честной заявкой
 * без оплаты, тот же принцип, что и у `FormBlock`, только реально попадающей
 * в БД и видимой в Dashboard «Заказы», а не декоративная форма.
 *
 * Когда `clientSecret` отсутствует, шаг оплаты не пропускается молча —
 * показывается `payment-unavailable` с причиной (`paymentUnavailableReason`,
 * см. `entities/order`): раньше отсутствие `clientSecret` выглядело для
 * покупателя неотличимо от «этому магазину оплата не нужна», даже когда
 * Stripe настроен, но упал по конкретной причине (например, сумма заказа
 * меньше минимума Stripe — реальный случай для дешёвых позиций, не
 * гипотетический).
 */
export function CartWidget({ businessId, hideFab }: CartWidgetProps) {
  const ensureBusiness = useCartStore((state) => state.ensureBusiness);
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clear = useCartStore((state) => state.clear);
  const itemCount = useCartStore(selectCartItemCount);
  const totalCents = useCartStore(selectCartTotalCents);
  const isOpen = useCartStore((state) => state.isOpen);
  const openPanel = useCartStore((state) => state.open);
  const closePanel = useCartStore((state) => state.closePanel);

  useEffect(() => {
    ensureBusiness(businessId);
  }, [businessId, ensureBusiness]);

  const [step, setStep] = useState<Step>('cart');

  // Кнопка корзины в шапке сайта (`HeaderActions.tsx`) открывает панель
  // напрямую через `useCartStore.open()`, минуя локальный `openCart()` этого
  // компонента — без сброса шага здесь повторное открытие после
  // незавершённого оформления заказа показало бы прошлый шаг (`checkout`/
  // `payment`), а не честно начинало с корзины. Сравнение прямо во время
  // рендера, не в эффекте (`react-hooks/set-state-in-effect` — тот же приём,
  // что и `autoPanedFor` в `WebsiteBuilderWidget.tsx`), потому что это чистая
  // синхронизация локального состояния с уже переданным `isOpen`, а не
  // побочный эффект над внешней системой.
  const [handledOpen, setHandledOpen] = useState(isOpen);
  if (isOpen !== handledOpen) {
    setHandledOpen(isOpen);
    if (isOpen) setStep('cart');
  }
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentUnavailableReason, setPaymentUnavailableReason] =
    useState<PaymentUnavailableReason | null>(null);
  // Заполняется реальным ответом `createOrder` — начиная с шага `payment`/
  // `payment-unavailable`, показываем `submittedOrder.totalCents`, НЕ
  // клиентский `totalCents` из корзины: если применился промокод, реальная
  // сумма к оплате меньше суммы товаров в корзине (см. `PRICING_ARCHITECTURE.md`
  // §5/§6) — источник истины всегда backend, не клиентский предпросмотр.
  const [submittedOrder, setSubmittedOrder] = useState<CreateOrderResult | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<CouponPreviewResult | null>(null);
  const [isCheckingCoupon, setCheckingCoupon] = useState(false);

  function openCart() {
    setStep('cart');
    openPanel();
  }

  function closeModal() {
    closePanel();
  }

  /** Предпросмотр промокода (Pricing Engine, Phase 17 — см.
   * `PRICING_ARCHITECTURE.md` §5) — вызывается ДО оформления заказа, чтобы
   * сразу показать "Применено ✓ / Промокод не найден", не дожидаясь сабмита
   * всей формы. `totalCents` здесь — сумма товаров в корзине ДО скидки, то
   * есть именно `subtotalCents` в терминах Pricing Engine (в корзине скидка
   * ещё не применена ни к чему). Реальное применение купона пересчитывается
   * заново, независимо, на backend при отправке заказа ниже — эта проверка
   * только для UX, не источник истины. */
  async function applyCoupon() {
    const trimmed = couponCode.trim();
    if (!trimmed) return;
    setCheckingCoupon(true);
    try {
      const result = await previewCoupon(businessId, trimmed, totalCents);
      setCouponResult(result);
    } catch {
      setCouponResult({ valid: false, reason: 'not_found' });
    } finally {
      setCheckingCoupon(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!customerName.trim()) {
      setError('Введите имя');
      return;
    }

    setSubmitting(true);
    setError(null);
    // `createOrder` никогда не бросает исключение (см. её комментарий,
    // `entities/order/api/create-order.ts`) — backend-ошибка (невалидный
    // телефон/email, распроданный товар, невалидный промокод) возвращается
    // как `{ ok: false, error }`, а не как `throw`. Причина: `throw` из
    // Server Action в production-сборке Next.js стирает реальный текст
    // ошибки в нечитаемый "Minified React error #NNN" — реальный баг,
    // пойманный вживую на попытке настоящего покупателя оформить заказ.
    const outcome = await createOrder(businessId, {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerNote: customerNote.trim() || undefined,
      couponCode: couponResult?.valid ? couponCode.trim() : undefined,
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    });
    setSubmitting(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }

    const order = outcome.order;
    setSubmittedOrder(order);
    if (order.clientSecret) {
      // Заказ уже создан на backend, но ещё не оплачен — корзину чистим
      // только после успешной оплаты (см. `PaymentForm.onPaid` ниже), не
      // здесь: иначе неудачная/незавершённая оплата потеряла бы корзину.
      setClientSecret(order.clientSecret);
      setStep('payment');
    } else if (order.paymentUnavailableReason) {
      // Корзину не чистим прямо здесь — экран ниже ещё показывает
      // итоговую сумму заказа, `clear()` вызывается только при закрытии
      // этого шага (тот же порядок, что и у успешной оплаты выше).
      setPaymentUnavailableReason(order.paymentUnavailableReason);
      setStep('payment-unavailable');
    } else {
      clear();
      setStep('success');
    }
  }

  // Каждый `CartItem.currency` уже равен `Business.currency` (Currency
  // System, ROADMAP.md §8 — единая валюта на бизнес, товар не хранит свою
  // отдельно), поэтому первого элемента достаточно. Фолбэк на дефолт
  // валюты — только для пустой корзины: в этом состоянии сумма нигде не
  // рендерится (`items.length === 0` показывает отдельный `EmptyState`
  // выше, до шага оформления), так что значение здесь никогда не попадает
  // на экран — просто держит `currency` определённым типом, а не `string
  // | undefined`, ниже по функции.
  const currency = items[0]?.currency ?? DEFAULT_BUSINESS_CURRENCY;

  return (
    <>
      {!hideFab && (
        <button type="button" className={styles.fab} aria-label="Корзина" onClick={openCart}>
          <ShoppingBagIcon />
          {itemCount > 0 && <span className={styles.fab__badge}>{itemCount}</span>}
        </button>
      )}

      {isOpen && (
        <Modal onClose={closeModal} label="Корзина" className={styles.modal}>
          {step === 'cart' && (
            <>
              <div className={styles.header}>
                <h2 className={styles.title}>Корзина</h2>
                <button
                  type="button"
                  className={styles.close}
                  aria-label="Закрыть"
                  onClick={closeModal}
                >
                  <CloseIcon />
                </button>
              </div>

              {items.length === 0 ? (
                <p className={styles.empty}>
                  Корзина пуста — добавьте товары со страницы каталога.
                </p>
              ) : (
                <>
                  <ul className={styles.list}>
                    {items.map((item) => (
                      <li key={item.productId} className={styles.row}>
                        <div className={styles['row__image']}>
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- превью фото товара из корзины
                            <img src={item.image} alt="" />
                          ) : (
                            <ShoppingBagIcon />
                          )}
                        </div>
                        <div className={styles.row__body}>
                          <span className={styles.row__title}>{item.name}</span>
                          <span className={styles.row__price}>
                            {formatMoney(item.priceCents, item.currency)}
                          </span>
                        </div>
                        <div className={styles.stepper}>
                          <button
                            type="button"
                            aria-label="Уменьшить количество"
                            onClick={() => setQuantity(item.productId, item.quantity - 1)}
                          >
                            <MinusIcon />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Увеличить количество"
                            onClick={() => setQuantity(item.productId, item.quantity + 1)}
                          >
                            <PlusIcon />
                          </button>
                        </div>
                        <button
                          type="button"
                          className={styles.remove}
                          aria-label={`Убрать «${item.name}» из корзины`}
                          onClick={() => removeItem(item.productId)}
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className={styles.coupon}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Промокод"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                        // Сбрасываем результат предыдущей проверки при
                        // редактировании кода — иначе "Применено ✓" осталось
                        // бы видно для уже изменённого, непроверенного текста.
                        setCouponResult(null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void applyCoupon()}
                      disabled={!couponCode.trim() || isCheckingCoupon}
                    >
                      {isCheckingCoupon ? 'Проверяем…' : 'Применить'}
                    </Button>
                  </div>

                  {couponResult &&
                    (couponResult.valid ? (
                      <p className={styles.couponApplied}>
                        Промокод применён: −{formatMoney(couponResult.discountCents, currency)}
                      </p>
                    ) : (
                      <p className={styles.error} role="alert">
                        {DISCOUNT_REJECTION_LABELS[couponResult.reason]}
                      </p>
                    ))}

                  <div className={styles.total}>
                    <span>Итого</span>
                    <span>
                      {formatMoney(
                        totalCents - (couponResult?.valid ? couponResult.discountCents : 0),
                        currency,
                      )}
                    </span>
                  </div>

                  <Button onClick={() => setStep('checkout')}>Оформить заказ</Button>
                </>
              )}
            </>
          )}

          {step === 'checkout' && (
            <>
              <div className={styles.header}>
                <h2 className={styles.title}>Оформление заказа</h2>
                <button
                  type="button"
                  className={styles.close}
                  aria-label="Закрыть"
                  onClick={closeModal}
                >
                  <CloseIcon />
                </button>
              </div>

              <p className={styles.hint}>
                Продавец получит ваш заказ и свяжется с вами для подтверждения.
              </p>

              <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Имя"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  autoFocus
                />
                <input
                  type="tel"
                  className={styles.input}
                  placeholder="Телефон"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
                <input
                  type="email"
                  className={styles.input}
                  placeholder="Email (необязательно)"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                />
                <textarea
                  className={styles.textarea}
                  rows={3}
                  placeholder="Комментарий к заказу (необязательно)"
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                />

                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}

                <div className={styles.actions}>
                  <Button type="button" variant="outline" onClick={() => setStep('cart')}>
                    Назад
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Отправляем…' : 'Продолжить'}
                  </Button>
                </div>
              </form>
            </>
          )}

          {step === 'payment' && clientSecret && submittedOrder && (
            <>
              <div className={styles.header}>
                <h2 className={styles.title}>Оплата</h2>
                <button
                  type="button"
                  className={styles.close}
                  aria-label="Закрыть"
                  onClick={closeModal}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className={styles.total}>
                <span>К оплате</span>
                <span>{formatMoney(submittedOrder.totalCents, submittedOrder.currency)}</span>
              </div>

              <StripePaymentForm
                clientSecret={clientSecret}
                onPaid={() => {
                  clear();
                  setStep('success');
                }}
              />
            </>
          )}

          {step === 'payment-unavailable' && paymentUnavailableReason && submittedOrder && (
            <>
              <div className={styles.header}>
                <h2 className={styles.title}>Оплата</h2>
                <button
                  type="button"
                  className={styles.close}
                  aria-label="Закрыть"
                  onClick={closeModal}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className={styles.total}>
                <span>Сумма заказа</span>
                <span>{formatMoney(submittedOrder.totalCents, submittedOrder.currency)}</span>
              </div>

              <div
                className={styles.paymentUnavailable}
                title={PAYMENT_UNAVAILABLE_REASON_LABELS[paymentUnavailableReason]}
              >
                <span className={styles['paymentUnavailable__badge']}>
                  Оплата картой недоступна
                </span>
                <p className={styles['paymentUnavailable__text']}>
                  {PAYMENT_UNAVAILABLE_REASON_LABELS[paymentUnavailableReason]}
                </p>
              </div>

              <Button
                onClick={() => {
                  clear();
                  setStep('success');
                }}
              >
                Понятно
              </Button>
            </>
          )}

          {step === 'success' && (
            <div className={styles.success}>
              <ShoppingBagIcon className={styles['success__icon']} />
              <h2 className={styles.title}>Заявка отправлена!</h2>
              <p className={styles.hint}>Продавец получил ваш заказ и скоро свяжется с вами.</p>
              <Button onClick={closeModal}>Закрыть</Button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

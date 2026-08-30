'use client';

import { useCallback } from 'react';
import { EMPTY_LINK_TARGET, type LinkTarget, type WebsitePage } from '@/entities/website';
import { getPublicProducts } from '@/entities/product';
import { getPublicServices } from '@/entities/service';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import styles from './LinkField.module.scss';

export interface LinkFieldProps {
  value: LinkTarget | undefined;
  onChange: (value: LinkTarget) => void;
  pages: WebsitePage[];
  businessId: string;
  /** См. `FieldSchema`'s `control: 'link'` в `entities/website/model/
   * registry.ts` — только `button`/`buttongroup`/`cta` включают это. */
  actionsEnabled?: boolean;
}

const BASE_TARGET_TYPES: { value: LinkTarget['type']; label: string }[] = [
  { value: 'page', label: 'Страница сайта' },
  { value: 'external', label: 'Внешняя ссылка' },
  { value: 'anchor', label: 'Якорь на этой странице' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Почта' },
];

const ACTION_TARGET_TYPES: { value: LinkTarget['type']; label: string }[] = [
  { value: 'addToCart', label: 'Добавить товар в корзину' },
  { value: 'bookAppointment', label: 'Записаться на услугу' },
];

/**
 * Составной контрол для `FieldSchema` с `control: 'link'` — дропдаун
 * выбирает ТИП цели (внешняя ссылка / страница ЭТОГО сайта / якорь /
 * телефон / почта / — у кнопок ещё и «добавить товар в корзину»/«записаться
 * на услугу», см. `actionsEnabled`), под ним — единственное поле, нужное
 * именно этому типу. Раньше все эти случаи были одним `control: 'url'`, где
 * «страница сайта» была вообще недостижима (реальных страниц больше одной
 * не было — см. ROADMAP.md Phase 1/2), поэтому ссылка на другую страницу
 * означала буквально вписать её будущий адрес руками и не иметь способа
 * обновить его при переименовании страницы (`resolveLinkHref` в
 * `entities/website/model/resolve-link.ts` решает это, разрешая `pageId` в
 * путь заново при каждом рендере — здесь только форма ввода).
 *
 * `addToCart`/`bookAppointment` (ROADMAP.md §3.4/§8 Phase 4) — дропдаун
 * товаров/услуг бизнеса, дозагружаемый тем же анонимным `getPublicProducts`/
 * `getPublicServices`, что уже использует `productgrid`/`servicegrid`
 * (владелец в билдере видит ровно тот же список, что увидел бы посетитель).
 * Загружается лениво — запрос уходит, только когда выбран соответствующий
 * тип, не при каждом открытии инспектора любого блока с полем-ссылкой.
 */
export function LinkField({ value, onChange, pages, businessId, actionsEnabled }: LinkFieldProps) {
  const target = value ?? EMPTY_LINK_TARGET;

  // Ленивая загрузка через содержимое fetcher'а, не через условный выбор
  // МЕЖДУ двумя `useCallback` — второе нарушало бы Rules of Hooks (число
  // вызовов хука должно быть одинаковым на каждый рендер, а условие here
  // менялось бы вместе с `target.type`). Сеть дёргается, только когда тип
  // реально выбран — тот же приём, что и в `BookingModal.tsx`
  // (`date ? getAvailability(...) : Promise.resolve([])`).
  const productsFetcher = useCallback(
    () => (target.type === 'addToCart' ? getPublicProducts(businessId) : Promise.resolve([])),
    [businessId, target.type],
  );
  const products = useAsyncData(productsFetcher);

  const servicesFetcher = useCallback(
    () => (target.type === 'bookAppointment' ? getPublicServices(businessId) : Promise.resolve([])),
    [businessId, target.type],
  );
  const services = useAsyncData(servicesFetcher);

  function handleTypeChange(nextType: LinkTarget['type']) {
    if (nextType === 'page') onChange({ type: 'page', pageId: pages[0]?.id ?? '' });
    else if (nextType === 'external') onChange({ type: 'external', url: '' });
    else if (nextType === 'anchor') onChange({ type: 'anchor', anchor: '' });
    else if (nextType === 'phone') onChange({ type: 'phone', phone: '' });
    else if (nextType === 'email') onChange({ type: 'email', email: '' });
    else if (nextType === 'addToCart') onChange({ type: 'addToCart', productId: '' });
    else onChange({ type: 'bookAppointment', serviceId: '' });
  }

  return (
    <div className={styles.field}>
      <select
        className={styles.typeSelect}
        value={target.type}
        onChange={(event) => handleTypeChange(event.target.value as LinkTarget['type'])}
      >
        {BASE_TARGET_TYPES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {actionsEnabled &&
          ACTION_TARGET_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>

      {target.type === 'page' &&
        (pages.length > 0 ? (
          <select
            className={styles.valueSelect}
            value={target.pageId}
            onChange={(event) => onChange({ type: 'page', pageId: event.target.value })}
          >
            {pages.map((page, index) => (
              <option key={page.id} value={page.id}>
                {index === 0 ? `${page.title} (главная)` : page.title}
              </option>
            ))}
          </select>
        ) : (
          <p className={styles.hint}>На сайте пока нет ни одной страницы.</p>
        ))}

      {target.type === 'external' && (
        <input
          type="url"
          className={styles.valueInput}
          placeholder="https://…"
          value={target.url}
          onChange={(event) => onChange({ type: 'external', url: event.target.value })}
        />
      )}

      {target.type === 'anchor' && (
        <div className={styles.anchorRow}>
          <span className={styles.anchorPrefix}>#</span>
          <input
            type="text"
            className={styles.valueInput}
            placeholder="contact"
            value={target.anchor}
            onChange={(event) =>
              onChange({ type: 'anchor', anchor: event.target.value.replace(/^#/, '') })
            }
          />
        </div>
      )}

      {target.type === 'phone' && (
        <input
          type="tel"
          className={styles.valueInput}
          placeholder="+7 900 000-00-00"
          value={target.phone}
          onChange={(event) => onChange({ type: 'phone', phone: event.target.value })}
        />
      )}

      {target.type === 'email' && (
        <input
          type="email"
          className={styles.valueInput}
          placeholder="mail@example.com"
          value={target.email}
          onChange={(event) => onChange({ type: 'email', email: event.target.value })}
        />
      )}

      {target.type === 'addToCart' &&
        (products.status === 'success' && (products.data ?? []).length > 0 ? (
          <select
            className={styles.valueSelect}
            value={target.productId}
            onChange={(event) => onChange({ type: 'addToCart', productId: event.target.value })}
          >
            <option value="">Выберите товар</option>
            {(products.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {formatMoney(product.priceCents, product.currency)}
              </option>
            ))}
          </select>
        ) : (
          <p className={styles.hint}>
            {products.status === 'loading' ? 'Загружаем товары…' : 'В разделе «Товары» пока пусто.'}
          </p>
        ))}

      {target.type === 'bookAppointment' &&
        (services.status === 'success' && (services.data ?? []).length > 0 ? (
          <select
            className={styles.valueSelect}
            value={target.serviceId}
            onChange={(event) =>
              onChange({ type: 'bookAppointment', serviceId: event.target.value })
            }
          >
            <option value="">Выберите услугу</option>
            {(services.data ?? []).map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {formatMoney(service.priceCents, service.currency)}
              </option>
            ))}
          </select>
        ) : (
          <p className={styles.hint}>
            {services.status === 'loading' ? 'Загружаем услуги…' : 'В разделе «Услуги» пока пусто.'}
          </p>
        ))}
    </div>
  );
}

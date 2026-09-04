'use client';

import { useCallback, useEffect, type CSSProperties } from 'react';
import { useCartStore } from '@/entities/cart';
import { FavoriteButton, useFavoriteStore } from '@/entities/favorite';
import { getPublicProducts, type PublicProduct } from '@/entities/product';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/format-money';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { ShoppingBagIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import type { DataSourceValue } from '../../model/types';
import { SectionHeading } from '../shared/SectionHeading';
import primitives from '../shared/primitives.module.scss';
import styles from './commerce.module.scss';

// --- ProductGrid -------------------------------------------------------
// Первый data-driven блок в реестре (см. ROADMAP.md §3.4) — не хранит
// товары в своих `props`, только параметры запроса (`dataSource`, см.
// `DataSourceValue` в `model/types.ts`). Сами товары дозагружаются заново
// при каждом рендере через анонимный `getPublicProducts` — тот же вызов и
// тот же результат что на канвасе билдера, что в Preview, что на публичном
// сайте (см. корневой план фичи, «Preview = тот же рендерер, что и
// публичная страница» — здесь это верно и для данных, не только для
// вёрстки). Требует включённой капабилити `commerce` (см. `capability`
// ниже) — сам блок это не проверяет, фильтрация только на уровне
// библиотеки компонентов (`ComponentLibraryPanel`), уже размещённый блок
// продолжает работать даже если капабилити потом выключили (см. `registry.
// ts`, комментарий `BlockDefinition.capability`).
//
// Собственная карточка (не переиспользует `RepeatableSimpleCards`, как
// `cards`/`articles`) — той негде показать кнопку «В корзину» на каждый
// элемент, а `productgrid` — единственный блок, которому реально нужно
// действие на карточке, не просто клик-переход.

interface ProductGridProps {
  eyebrow: string;
  heading: string;
  description: string;
  dataSource: DataSourceValue;
  columns: number;
}

function sortProducts(products: PublicProduct[], sort: DataSourceValue['sort']): PublicProduct[] {
  const sorted = [...products];
  if (sort === 'price-asc') sorted.sort((a, b) => a.priceCents - b.priceCents);
  else if (sort === 'price-desc') sorted.sort((a, b) => b.priceCents - a.priceCents);
  // 'newest' — уже порядок `listPublic` на backend (по `order`, см.
  // `ProductsService`), явно сортировать заново не нужно.
  return sorted;
}

interface ProductCardProps {
  product: PublicProduct;
  /** См. `BlockRendererProps.isEditing` — внутри билдера кнопка не должна
   * реально класть товар в корзину, тот же принцип, что и у `FormBlock`
   * («форма не должна реально отправляться, пока её редактируют»). */
  isEditing?: boolean;
}

function ProductCard({ product, isEditing }: ProductCardProps) {
  const addItem = useCartStore((state) => state.addItem);
  const isOutOfStock = product.stock !== null && product.stock <= 0;

  function handleAddToCart() {
    if (isEditing) return;
    addItem({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      image: product.images[0] ?? null,
    });
  }

  return (
    <div className={cn(primitives['simple-card'], styles.card)}>
      <FavoriteButton
        className={styles['card__favorite']}
        isEditing={isEditing}
        item={{
          id: product.id,
          kind: 'product',
          name: product.name,
          image: product.images[0] ?? null,
          priceCents: product.priceCents,
          currency: product.currency,
        }}
      />
      {product.images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем фото товара
        <img src={product.images[0]} alt="" className={primitives['simple-card__image']} />
      ) : (
        <div className={styles['card__no-image']}>
          <ShoppingBagIcon />
        </div>
      )}
      <div className={primitives['simple-card__body']}>
        <h3 className={primitives['simple-card__title']}>{product.name}</h3>
        {product.description && (
          <p className={primitives['simple-card__description']}>{product.description}</p>
        )}
        <div className={styles['card__footer']}>
          <span className={styles['card__price']}>
            {formatMoney(product.priceCents, product.currency)}
          </span>
          <button
            type="button"
            className={styles['card__button']}
            disabled={isOutOfStock}
            onClick={handleAddToCart}
          >
            <ShoppingBagIcon />
            {isOutOfStock ? 'Нет в наличии' : 'В корзину'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductGridRenderer({ props, business, isEditing }: BlockRendererProps<ProductGridProps>) {
  const fetcher = useCallback(() => getPublicProducts(business.businessId), [business.businessId]);
  const { status, data, error } = useAsyncData(fetcher);

  // Раньше самого первого клика по сердечку карточки (`FavoriteButton`) —
  // не только когда посетитель откроет попап «Избранное» в шапке
  // (`FavoritesPanel.tsx`, тот вызов покрывает только чтение/отображение).
  // Без этого `toggle()` с карточки писал бы в `localStorage` под ЧУЖИМ
  // `businessId`, оставшимся от предыдущего сайта Таверны в этом браузере
  // (тот же сценарий, что и у `useCartStore.ensureBusiness`, см. её
  // комментарий) — и при следующем открытии панели избранного этого же
  // сайта только что добавленный товар молча пропал бы (`ensureBusiness`
  // увидел бы несовпадение `businessId` и сбросил список).
  const ensureFavoritesBusiness = useFavoriteStore((state) => state.ensureBusiness);
  useEffect(() => {
    ensureFavoritesBusiness(business.businessId);
  }, [business.businessId, ensureFavoritesBusiness]);

  if (status === 'loading') {
    return (
      <div className={styles.placeholder}>
        <ShoppingBagIcon />
        <span>Загружаем товары…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.placeholder}>
        <ShoppingBagIcon />
        <span>{error ?? 'Не удалось загрузить товары'}</span>
      </div>
    );
  }

  const sorted = sortProducts(data ?? [], props.dataSource.sort);
  const limited = sorted.slice(0, props.dataSource.limit);

  if (limited.length === 0) {
    return (
      <div className={styles.placeholder}>
        <ShoppingBagIcon />
        <span>Здесь пока нет товаров — добавьте их в разделе «Товары» дашборда бизнеса.</span>
      </div>
    );
  }

  return (
    <div className={primitives.block}>
      <SectionHeading
        eyebrow={props.eyebrow}
        heading={props.heading}
        description={props.description}
      />
      <div
        className={primitives['simple-grid']}
        style={{ '--grid-columns': props.columns } as CSSProperties}
      >
        {limited.map((product) => (
          <ProductCard key={product.id} product={product} isEditing={isEditing} />
        ))}
      </div>
    </div>
  );
}

const productGridFields: FieldSchema[] = [
  { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
  { key: 'heading', label: 'Заголовок', control: 'text' },
  { key: 'description', label: 'Подзаголовок', control: 'textarea', rows: 2 },
  { key: 'dataSource', label: 'Товары', control: 'dataSource', entity: 'product' },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 4 },
];

registerBlock<ProductGridProps>({
  type: 'productgrid',
  label: 'Каталог товаров',
  category: 'commerce',
  icon: ShoppingBagIcon,
  description: 'Товары из раздела «Товары» дашборда — с ценами, фото и кнопкой «В корзину»',
  capability: 'commerce',
  defaultProps: {
    eyebrow: '',
    heading: 'Наши товары',
    description: '',
    dataSource: { limit: 6, sort: 'newest' },
    columns: 3,
  },
  fields: productGridFields,
  Renderer: ProductGridRenderer,
});

/** Общий формат сохранённого элемента избранного — товар или услуга (см.
 * `kind`), одна и та же структура для обоих, чтобы `FavoritesPanel.tsx` не
 * знал деталей ни одной из капабилити напрямую (тот же принцип, что и у
 * `CartItem`, который тоже не знает ничего о `Product`, только цену/фото/
 * название). Список сущностей растёт по мере появления новых data-source
 * капабилити — см. `entity` у `control: 'dataSource'` в `registry.ts`. */
export interface FavoriteItem {
  id: string;
  kind: 'product' | 'service';
  name: string;
  image: string | null;
  priceCents: number;
  currency: string;
}

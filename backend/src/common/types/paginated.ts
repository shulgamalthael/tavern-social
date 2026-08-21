/** Общая форма страницы курсорной пагинации — `nextCursor: null` значит
 * «дальше ничего нет». Тот же контракт, что и у `NotificationsListDto`, для
 * любого нового списочного эндпоинта. */
export interface PaginatedDto<T> {
  items: T[];
  nextCursor: string | null;
}

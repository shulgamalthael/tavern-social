import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Верхний потолок `limit` для любого курсорного списка в проекте — тот же
 * потолок, что и у `ListNotificationsDto` изначально. Экспортируется отдельно,
 * чтобы эндпоинты, которым нужен один «максимально большой» запрос вместо
 * настоящей бесконечной прокрутки (см. `UsersController.getFriends`), просили
 * ровно этот же потолок, а не свою отдельную «магическую» цифру. */
export const MAX_PAGINATION_LIMIT = 50;

/** Общий query-контракт для курсорной пагинации — тот же вид query-параметров
 * (`cursor`/`limit`), что и у `ListNotificationsDto` (первого места в проекте,
 * где эта пагинация появилась). Новые списочные эндпоинты переиспользуют этот
 * класс вместо копирования тех же двух полей с теми же ограничениями. */
export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit должен быть целым числом' })
  @Min(1, { message: 'limit должен быть не меньше 1' })
  @Max(MAX_PAGINATION_LIMIT, { message: `limit должен быть не больше ${MAX_PAGINATION_LIMIT}` })
  limit?: number;
}

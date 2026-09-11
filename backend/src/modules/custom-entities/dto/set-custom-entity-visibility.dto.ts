import { IsBoolean } from 'class-validator';

/**
 * Отдельный DTO/эндпоинт от `UpdateCustomEntityDto` (переименование) — тот
 * же принцип разделения, что и там: `isPublic` не косметика вроде названия,
 * а осознанное решение владельца "разрешить анонимному посетителю сайта
 * читать записи этой сущности" (см. `CustomEntity.isPublic`'s комментарий в
 * schema.prisma). Отдельный узкий эндпоинт вместо добавления поля в общий
 * `UpdateCustomEntityDto` — чтобы в коде/логах/аудите было однозначно видно
 * само действие "включил публичность", а не потерялось среди прочих полей
 * произвольного PATCH.
 */
export class SetCustomEntityVisibilityDto {
  @IsBoolean()
  isPublic!: boolean;
}

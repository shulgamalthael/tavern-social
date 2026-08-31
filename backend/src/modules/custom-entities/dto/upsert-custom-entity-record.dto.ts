import { IsObject } from 'class-validator';

/** `data` — тот же приём, что `field` в `AddCustomEntityFieldDto`, форма
 * зависит от `CustomEntity.fields` конкретной сущности, поэтому проверяется
 * в `CustomEntitiesService` через `validateRecordData`, не здесь. Одна DTO
 * для create/update записи — оба принимают "весь объект data целиком", не
 * частичный patch (та же простота, что у формы на фронтенде, которая всегда
 * пересылает весь объект). */
export class UpsertCustomEntityRecordDto {
  @IsObject({ message: 'data должен быть объектом' })
  data!: Record<string, unknown>;
}

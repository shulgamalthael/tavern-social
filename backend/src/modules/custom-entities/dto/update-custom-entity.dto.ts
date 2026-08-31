import { IsString, Length } from 'class-validator';

/** Только переименование — `fields` намеренно недостижимо через этот DTO
 * (см. `CustomEntitiesService.rename`'s комментарий): поля можно только
 * добавлять через отдельный `addField`, никогда не заменять массивом целиком
 * здесь, иначе владелец мог бы случайно уронить поле, от которого уже
 * зависят существующие записи. */
export class UpdateCustomEntityDto {
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name!: string;
}

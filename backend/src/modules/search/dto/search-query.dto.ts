import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @Length(1, 100, { message: 'Запрос должен быть от 1 до 100 символов' })
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit должен быть целым числом' })
  @Min(1, { message: 'limit должен быть не меньше 1' })
  @Max(20, { message: 'limit должен быть не больше 20' })
  limit?: number;
}

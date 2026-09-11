import { IsString, Length } from 'class-validator';

export class RecordCatalogInsertDto {
  @IsString()
  @Length(1, 100)
  businessId!: string;
}

import { IsString, IsUrl, Length } from 'class-validator';

/** Одна ссылка соцсети из `Business.socialLinks` (см. схему) — свободный
 * `platform` (не enum), провалидированный `url`. */
export class SocialLinkDto {
  @IsString()
  @Length(1, 40)
  platform!: string;

  @IsUrl({}, { message: 'Ссылка должна быть корректным URL' })
  url!: string;
}

import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BusinessCategory } from '@prisma/client';
import { LOOSE_PHONE_MESSAGE, LOOSE_PHONE_PATTERN } from '@/common/lib/phone-validation';
import { SUPPORTED_CURRENCY_CODES } from '@/modules/currencies/currencies';
import { BUSINESS_CAPABILITIES, TAX_MODES } from '../businesses.types';
import { SocialLinkDto } from './social-link.dto';
import { WorkingHoursDto } from './working-hours.dto';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @Length(1, 120, { message: 'Название должно быть от 1 до 120 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug может содержать только строчные латинские буквы, цифры и дефисы',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000, { message: 'Описание не должно превышать 2000 символов' })
  description?: string;

  @IsOptional()
  @IsEnum(BusinessCategory, { message: 'Недопустимая категория' })
  category?: BusinessCategory;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsOptional()
  @Matches(LOOSE_PHONE_PATTERN, { message: LOOSE_PHONE_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  address?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsOptional()
  @IsString()
  @Length(0, 70, { message: 'SEO-заголовок не должен превышать 70 символов' })
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'SEO-описание не должно превышать 200 символов' })
  seoDescription?: string;

  /** Полный список, не diff/добавление одной капабилити — тот же принцип,
   * что и у `WebsitesService.saveDraft`'s страниц: клиент присылает весь
   * желаемый набор, сервер не пытается угадать «добавить» vs «убрать». */
  @IsOptional()
  @IsArray()
  @IsIn(BUSINESS_CAPABILITIES, { each: true, message: 'Неизвестная капабилити' })
  capabilities?: string[];

  /** Смена основной валюты бизнеса (Currency System, ROADMAP.md §8) — НЕ
   * конвертирует существующие `Product`/`Service` (у них и так нет своего
   * числового значения цены в другой валюте для конвертации, они просто
   * начнут показываться в новой валюте с теми же числами) и уж тем более
   * не трогает уже созданные `Order`/`Appointment` (у тех — снэпшот
   * `currency` на момент создания, см. их комментарии в schema.prisma).
   * Frontend обязан показать явное предупреждение перед этим вызовом (см.
   * `BusinessCurrencySection.tsx`) — сам backend предупреждение не
   * форсирует, только применяет то, что попросили. */
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCY_CODES, { message: 'Неподдерживаемая валюта' })
  currency?: string;

  /** Базисные пункты (2000 = 20.00%) — см. `Business.taxRateBps` в
   * schema.prisma и `PRICING_ARCHITECTURE.md` §3. */
  @IsOptional()
  @IsInt({ message: 'Ставка налога должна быть целым числом' })
  @Min(0, { message: 'Ставка налога не может быть отрицательной' })
  @Max(10_000, { message: 'Ставка налога не может превышать 100%' })
  taxRateBps?: number;

  @IsOptional()
  @IsIn(TAX_MODES, { message: 'Недопустимый режим налога' })
  taxMode?: string;

  /** `null` явно очищает часы (см. `WorkingHoursDto`'s комментарий) —
   * «часы не заданы» значит «принимаем записи в любое время», то поведение,
   * которое было единственным до этого поля вообще. */
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkingHoursDto)
  workingHours?: WorkingHoursDto | null;

  /** Адрес СОБСТВЕННОГО кошелька владельца для read-only Web3-витрины
   * (AI_PLATFORM_ROADMAP.md §2.6, AI-7, см. `Business.web3WalletAddress`
   * в schema.prisma) — не кошелёк покупателя. Пустая строка = очистить
   * (тот же приём "клиент присылает явное намерение", что и остальные
   * nullable-подобные поля этого DTO). */
  @IsOptional()
  @Matches(/^(0x[a-fA-F0-9]{40})?$/, {
    message: 'Адрес кошелька должен быть в формате 0x + 40 hex-символов',
  })
  web3WalletAddress?: string;

  /** Собственный API-ключ Alchemy бизнеса (BYOK, AI_PLATFORM_ROADMAP.md
   * §19.1, см. `Business.web3AlchemyApiKey`) — используется вместо
   * платформенного `ALCHEMY_API_KEY`, если задан. Пустая строка = удалить
   * сохранённый ключ (тот же приём, что у `web3WalletAddress` выше).
   * Формат ключей у Alchemy не документирован как стабильный, поэтому
   * только ограничение длины, не regex — строгий формат рискует однажды
   * отклонить настоящий валидный ключ. */
  @IsOptional()
  @IsString()
  @Length(0, 200, { message: 'API-ключ не должен превышать 200 символов' })
  web3AlchemyApiKey?: string;
}

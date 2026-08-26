import { IsString, Length } from 'class-validator';

export class ConnectDomainDto {
  /** Сырое значение из формы — нормализация и предметная валидация формата
   * происходят в `DomainsService.connectCustomDomain` (см. `lib/hostname.ts`),
   * здесь только базовая защита от пустой/огромной строки. */
  @IsString()
  @Length(1, 253, { message: 'Введите домен' })
  hostname!: string;
}

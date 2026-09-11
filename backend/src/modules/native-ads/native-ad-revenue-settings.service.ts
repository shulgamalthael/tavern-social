import { BadRequestException, Injectable } from '@nestjs/common';
import type { NativeAdRevenueSettings } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { UpdateNativeAdRevenueSettingsDto } from './dto/update-native-ad-revenue-settings.dto';

/** Фиксированный id синглтон-строки — см. `NativeAdRevenueSettings`'s
 * комментарий в schema.prisma: ровно одна строка, засеянная миграцией
 * (`prisma/migrations/20260906130000_add_native_ad_revenue`), не лениво
 * создаваемая при первом чтении (та гонка при параллельных первых запросах
 * не стоит того, чтобы её обрабатывать). */
const SETTINGS_ID = 'default';

/**
 * Админ-конфигурируемые проценты распределения выручки (корневой план
 * фичи, "creator share, platform fee, payment processing fee, minimum
 * payout — НЕ хардкод"). `get()` читается на каждое событие показа/клика
 * (`NativeAdCampaignsService.recordImpression/recordClick`) — не
 * кэшируется: одна дешёвая выборка по primary key, тот же уровень "не
 * оптимизировано заранее", что и у остального Phase 2/3 этого модуля (см.
 * `NativeAdFeedService`'s комментарий про отсутствие Redis).
 */
@Injectable()
export class NativeAdRevenueSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<NativeAdRevenueSettings> {
    const settings = await this.prisma.nativeAdRevenueSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    // Не должно происходить — строка засеяна миграцией — но не молчим,
    // если её всё же нет (например, БД восстановлена из бэкапа до
    // миграции): явная ошибка лучше падения на null ниже по цепочке.
    if (!settings) {
      throw new BadRequestException('Настройки распределения выручки не инициализированы');
    }
    return settings;
  }

  async update(dto: UpdateNativeAdRevenueSettingsDto): Promise<NativeAdRevenueSettings> {
    const total = dto.creatorRevenueShareBps + dto.platformFeeBps + dto.paymentProcessingFeeBps;
    if (total !== 10000) {
      throw new BadRequestException(
        `Три доли должны в сумме давать 100% (10000 базисных пунктов), сейчас ${total / 100}%`,
      );
    }

    return this.prisma.nativeAdRevenueSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...dto },
      update: { ...dto },
    });
  }
}

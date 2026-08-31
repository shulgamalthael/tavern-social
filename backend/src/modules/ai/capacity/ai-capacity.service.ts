import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis-client.provider';
import { GeminiQuotaService } from '../quota/gemini-quota.service';
import { geminiRpmBucketKey } from '../quota/gemini-quota.lib';
import { AI_LOG_EVENTS, AiAlertsService } from './ai-alerts.service';
import {
  computeCapacityStatus,
  percentOfSafetyLimit,
  shouldAdmit,
  type AiCapacityStatus,
  type AiPriorityLevel,
} from './ai-capacity.lib';
import type { AiCapacitySnapshotDto } from './ai-capacity.types';

const TPM_KEY_PREFIX = 'ai:tpm:';
const TPM_KEY_TTL_SECONDS = 65;

/**
 * Capacity Manager — RPM/RPD от `GeminiQuotaService` (уже реальный, глобальный
 * через Redis, с прошлой итерации) плюс TPM (не gate'ится — см. `bumpTpm`'s
 * комментарий) плюс перевод в NORMAL/WARNING/CRITICAL/EMERGENCY (§9-10
 * brief'а) и решение "пропускать ли AI-запрос с данным приоритетом при
 * текущем статусе" (`shouldAdmitOperation`, использует `shouldAdmit` из
 * `ai-capacity.lib.ts`).
 *
 * Периодически (не на каждый запрос) пишет `AiCapacitySnapshot` в Postgres —
 * `setInterval` внутри `OnModuleInit`, не `@nestjs/schedule`: в проекте нет
 * этой зависимости, а для одного таймера заводить новый пакет ради него было
 * бы избыточно (`OnModuleDestroy` корректно останавливает таймер при
 * shutdown/hot-reload, не оставляя висящих интервалов).
 */
@Injectable()
export class AiCapacityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiCapacityService.name);
  private snapshotTimer: NodeJS.Timeout | undefined;

  private readonly warningPercent: number;
  private readonly criticalPercent: number;
  private readonly emergencyPercent: number;
  private readonly snapshotIntervalMs: number;

  constructor(
    private readonly quota: GeminiQuotaService,
    private readonly prisma: PrismaService,
    private readonly alerts: AiAlertsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.warningPercent = config.aiCapacityWarningPercent;
    this.criticalPercent = config.aiCapacityCriticalPercent;
    this.emergencyPercent = config.aiCapacityEmergencyPercent;
    this.snapshotIntervalMs = config.aiCapacitySnapshotIntervalMs;
  }

  onModuleInit(): void {
    this.snapshotTimer = setInterval(() => {
      this.writeSnapshot().catch((error) => {
        this.logger.warn(
          `Не удалось записать capacity snapshot: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.snapshotIntervalMs);
    this.snapshotTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
  }

  async getSnapshot(): Promise<AiCapacitySnapshotDto> {
    const quotaSnapshot = await this.quota.getSnapshot();
    const tpmUsed = await this.getCurrentTpm();

    const rpmUsedPercent = percentOfSafetyLimit(
      quotaSnapshot.rpm.used,
      quotaSnapshot.rpm.safetyLimit,
    );
    const rpdUsedPercent = percentOfSafetyLimit(
      quotaSnapshot.rpd.used,
      quotaSnapshot.rpd.safetyLimit,
    );
    const status = this.statusFromPercents(rpmUsedPercent, rpdUsedPercent);

    return {
      rpm: { ...quotaSnapshot.rpm, usedPercent: rpmUsedPercent },
      rpd: { ...quotaSnapshot.rpd, usedPercent: rpdUsedPercent },
      tpm: { used: tpmUsed },
      status,
    };
  }

  statusFromPercents(rpmUsedPercent: number, rpdUsedPercent: number): AiCapacityStatus {
    const worstPercent = Math.max(rpmUsedPercent, rpdUsedPercent);
    return computeCapacityStatus(
      worstPercent,
      this.warningPercent,
      this.criticalPercent,
      this.emergencyPercent,
    );
  }

  /** §10-11 brief'а — единственное место, решающее "пропускать ли этот
   * AI-запрос ПРЯМО СЕЙЧАС", вызывается `AiGatewayService` ДО обращения к
   * `LlmProvider`/Gemini. */
  async shouldAdmitOperation(
    priority: AiPriorityLevel,
  ): Promise<{ admitted: boolean; status: AiCapacityStatus }> {
    const snapshot = await this.getSnapshot();
    return { admitted: shouldAdmit(priority, snapshot.status), status: snapshot.status };
  }

  /** Не gate'ится (в отличие от RPM/RPD) — см. изначальную постановку задачи:
   * "TPM используется значительно меньше доступного лимита", проблема
   * реально в количестве запросов, не в токенах. TPM здесь только
   * ОТСЛЕЖИВАЕТСЯ (§5/§8 brief'а), решения о допуске на нём не строятся. */
  async bumpTpm(totalTokens: number): Promise<void> {
    if (totalTokens <= 0) return;
    const key = `${TPM_KEY_PREFIX}${geminiRpmBucketKey(new Date())}`;
    const result = await this.redis.incrby(key, totalTokens);
    if (result === totalTokens) await this.redis.expire(key, TPM_KEY_TTL_SECONDS);
  }

  private async getCurrentTpm(): Promise<number> {
    const key = `${TPM_KEY_PREFIX}${geminiRpmBucketKey(new Date())}`;
    const raw = await this.redis.get(key);
    return Number(raw ?? 0);
  }

  private async writeSnapshot(): Promise<void> {
    const quotaSnapshot = await this.quota.getSnapshot();
    const rpmUsedPercent = percentOfSafetyLimit(
      quotaSnapshot.rpm.used,
      quotaSnapshot.rpm.safetyLimit,
    );
    const rpdUsedPercent = percentOfSafetyLimit(
      quotaSnapshot.rpd.used,
      quotaSnapshot.rpd.safetyLimit,
    );
    const status = this.statusFromPercents(rpmUsedPercent, rpdUsedPercent);

    await this.prisma.aiCapacitySnapshot.create({
      data: {
        rpmUsed: quotaSnapshot.rpm.used,
        rpmSafetyLimit: quotaSnapshot.rpm.safetyLimit,
        rpmOfficialLimit: quotaSnapshot.rpm.officialLimit,
        rpdUsed: quotaSnapshot.rpd.used,
        rpdSafetyLimit: quotaSnapshot.rpd.safetyLimit,
        rpdOfficialLimit: quotaSnapshot.rpd.officialLimit,
        status,
      },
    });

    await this.raiseAlertIfNeeded(status, rpmUsedPercent, rpdUsedPercent);
  }

  /** Вызывается и фоновым таймером (`writeSnapshot`), и
   * `AiRequestAccountingService` сразу после каждого реального запроса —
   * переход в WARNING/CRITICAL/EMERGENCY должен быть замечен быстро, не
   * только раз в `aiCapacitySnapshotIntervalMs`. */
  async raiseAlertIfNeeded(
    status: AiCapacityStatus,
    rpmUsedPercent: number,
    rpdUsedPercent: number,
  ): Promise<void> {
    if (status === 'normal') return;

    const message = `RPM ${rpmUsedPercent}%, RPD ${rpdUsedPercent}% от safety-лимита`;
    const eventByStatus: Record<
      Exclude<AiCapacityStatus, 'normal'>,
      { type: string; severity: 'warning' | 'critical' | 'emergency' }
    > = {
      warning: { type: AI_LOG_EVENTS.CAPACITY_WARNING, severity: 'warning' },
      critical: { type: AI_LOG_EVENTS.CAPACITY_CRITICAL, severity: 'critical' },
      emergency: { type: AI_LOG_EVENTS.CAPACITY_EMERGENCY, severity: 'emergency' },
    };
    const { type, severity } = eventByStatus[status];
    await this.alerts.raise(type, severity, message, { rpmUsedPercent, rpdUsedPercent });
  }
}

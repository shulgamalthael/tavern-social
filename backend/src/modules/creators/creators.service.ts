import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CreatorProfile, CreatorStatus } from '@prisma/client';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { RealtimeGateway } from '@/infrastructure/websocket/realtime.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { toPublicProfile } from '@/modules/users/users.mapper';
import { CreatorCategoriesService } from './creator-categories.service';
import {
  type CreatorIdentityWebhookEvent,
  CreatorIdentityService,
} from './creator-identity.service';
import { StripeConnectService } from './stripe-connect.service';
import type {
  AdminCreatorListItemDto,
  CreatorEligibilityDto,
  CreatorIdentitySessionDto,
  CreatorProfileDto,
} from './creators.types';
import type { StartCreatorOnboardingDto } from './dto/start-creator-onboarding.dto';
import type { UpdateCreatorSettingsDto } from './dto/update-creator-settings.dto';

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
} as const;

type ProfileWithCategories = CreatorProfile & {
  categories: { id: string; isPrimary: boolean; category: { slug: string; label: string } }[];
};

/**
 * Creator Monetization & Native Advertising, Phase 1 (AI_PLATFORM_ROADMAP.md
 * §79) — фундамент: eligibility, категории, верификация личности через
 * Stripe Identity, переключатели монетизации. Матчинг/реклама/деньги — более
 * поздние фазы (см. корневой план фичи), здесь их нет вообще.
 */
@Injectable()
export class CreatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly categoriesService: CreatorCategoriesService,
    private readonly identityService: CreatorIdentityService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /** Чисто вычисляемое — см. `CreatorProfile`'s комментарий в схеме про то,
   * почему `NOT_ELIGIBLE`/`ELIGIBLE` нигде не хранятся. Это и есть
   * "CreatorEligibilityRule" из корневого плана фичи: один вызов, одно
   * место, где живёт правило порога — расширять здесь же, если появится ещё
   * один критерий. §85: порог теперь по подписчикам (`Subscription`), не
   * друзьям (`Friendship`) — подписчики односторонние и ничем не
   * ограничены, реальная аудитория creator'а, друзья — личный социальный
   * граф, не то же самое (см. `Subscription`'s комментарий в schema.prisma). */
  async getEligibility(userId: string): Promise<CreatorEligibilityDto> {
    const config = this.configService.get<AppConfig>('app')!;
    const requiredSubscribers = config.creatorMinSubscribers;

    const [subscriberCount, profile] = await Promise.all([
      this.subscriptionsService.countFollowers(userId),
      this.prisma.creatorProfile.findUnique({ where: { userId }, select: { id: true } }),
    ]);

    return {
      eligible: subscriberCount >= requiredSubscribers,
      subscriberCount,
      requiredSubscribers,
      hasStarted: Boolean(profile),
    };
  }

  async getMyProfile(userId: string): Promise<CreatorProfileDto | null> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    return profile ? this.toDto(profile) : null;
  }

  /** Лёгкий вариант `getMyProfile` — только статус, без категорий/настроек.
   * `UsersController.getById` вызывает это на КАЖДЫЙ просмотр чужого
   * профиля (`CreatorBar`, `widgets/creator-bar`, виден любому посетителю
   * страницы активного Creator'а) — полный `getMyProfile` тянул бы лишний
   * `include` категорий туда, где нужен один статус. `null` — нет
   * `CreatorProfile` вообще. */
  async getStatusForUser(userId: string): Promise<CreatorStatus | null> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
      select: { status: true },
    });
    return profile?.status ?? null;
  }

  /** Валидирует eligibility ЗАНОВО на сервере — клиентский гейт (кнопка
   * "Стать блогером") никогда не единственная проверка, тот же untrusted-
   * input принцип, что и везде в проекте (`AGENTS.md` §3), просто источник
   * недоверия здесь — не ИИ, а обычный браузер, которому нельзя верить на
   * слово "я уже набрал 2000 друзей". */
  async startOnboarding(
    userId: string,
    dto: StartCreatorOnboardingDto,
  ): Promise<CreatorProfileDto> {
    const existing = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new BadRequestException('Вы уже начали регистрацию Creator');
    }

    const eligibility = await this.getEligibility(userId);
    if (!eligibility.eligible) {
      throw new ForbiddenException(
        `Недостаточно подписчиков для статуса Creator: ${eligibility.subscriberCount}/${eligibility.requiredSubscribers}`,
      );
    }

    const additionalIds = dto.additionalCategoryIds ?? [];
    if (additionalIds.includes(dto.primaryCategoryId)) {
      throw new BadRequestException('Основная категория не может повторяться среди дополнительных');
    }

    const allCategories = await this.categoriesService.listAll();
    const validIds = new Set(allCategories.map((category) => category.id));
    for (const id of [dto.primaryCategoryId, ...additionalIds]) {
      if (!validIds.has(id)) {
        throw new BadRequestException(`Категория "${id}" не найдена`);
      }
    }

    const profile = await this.prisma.creatorProfile.create({
      data: {
        userId,
        categories: {
          create: [
            { categoryId: dto.primaryCategoryId, isPrimary: true },
            ...additionalIds.map((categoryId) => ({ categoryId, isPrimary: false })),
          ],
        },
      },
      include: PROFILE_INCLUDE,
    });

    return this.toDto(profile);
  }

  async updateSettings(
    userId: string,
    patch: UpdateCreatorSettingsDto,
  ): Promise<CreatorProfileDto> {
    const existing = await this.requireProfile(userId);
    const updated = await this.prisma.creatorProfile.update({
      where: { id: existing.id },
      data: { ...patch },
      include: PROFILE_INCLUDE,
    });
    return this.toDto(updated);
  }

  /** Разрешено из `verification_pending` (первая попытка) и `rejected`
   * (повторная верификация — явное требование корневого плана фичи §3). */
  async createIdentitySession(userId: string): Promise<CreatorIdentitySessionDto> {
    const profile = await this.requireProfile(userId);
    if (profile.status !== 'verification_pending' && profile.status !== 'rejected') {
      throw new BadRequestException(
        'Верификация личности недоступна в текущем статусе аккаунта Creator',
      );
    }

    const session = await this.identityService.createVerificationSession(userId, profile.id);
    await this.prisma.creatorProfile.update({
      where: { id: profile.id },
      data: {
        stripeIdentitySessionId: session.sessionId,
        status: 'verification_pending',
        rejectionReason: null,
      },
    });

    return { clientSecret: session.clientSecret };
  }

  /** Вызывается только из `StripeIdentityWebhookController` — подпись уже
   * проверена ДО этого метода (см. `CreatorIdentityService.parseWebhookEvent`),
   * здесь просто применяем разобранный результат. Тихий no-op на неизвестную
   * `sessionId` — та же "вебхук не должен 500-ть на устаревшем/неизвестном
   * id" дисциплина, что у `AdCampaignsService.recordImpression`. */
  async handleIdentityWebhookEvent(event: CreatorIdentityWebhookEvent): Promise<void> {
    const profile = await this.prisma.creatorProfile.findFirst({
      where: { stripeIdentitySessionId: event.sessionId },
    });
    if (!profile) return;

    if (event.type === 'verified') {
      const now = new Date();
      await this.prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { status: 'active', verifiedAt: now, activatedAt: now, rejectionReason: null },
      });
      await this.notifyStatusChange(
        profile.userId,
        'active',
        'Личность подтверждена — вы теперь Creator! Загляните в Creator Studio.',
      );
      return;
    }

    const reason =
      event.type === 'requires_input'
        ? (event.reason ?? 'Не удалось подтвердить документ')
        : 'Верификация отменена';
    await this.prisma.creatorProfile.update({
      where: { id: profile.id },
      data: { status: 'rejected', rejectionReason: reason },
    });
    await this.notifyStatusChange(
      profile.userId,
      'rejected',
      `Верификация не пройдена: ${reason}. Вы можете попробовать снова.`,
    );
  }

  // --- admin ---

  async adminList(status?: CreatorStatus): Promise<AdminCreatorListItemDto[]> {
    const profiles = await this.prisma.creatorProfile.findMany({
      where: status ? { status } : undefined,
      include: {
        user: true,
        categories: { where: { isPrimary: true }, include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return profiles.map((profile) => ({
      id: profile.id,
      status: profile.status,
      rejectionReason: profile.rejectionReason,
      suspendedReason: profile.suspendedReason,
      user: toPublicProfile(profile.user),
      primaryCategory: profile.categories[0]?.category.label ?? null,
      createdAt: profile.createdAt.toISOString(),
    }));
  }

  async adminSuspend(creatorProfileId: string, reason?: string): Promise<void> {
    const existing = await this.findProfileOrThrow(creatorProfileId);
    if (existing.status !== 'active') {
      throw new BadRequestException('Приостановить можно только активного Creator');
    }

    await this.prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason ?? null },
    });
    await this.notifyStatusChange(
      existing.userId,
      'suspended',
      `Ваш статус Creator приостановлен администратором${reason ? `: ${reason}` : ''}.`,
    );
  }

  async adminReinstate(creatorProfileId: string): Promise<void> {
    const existing = await this.findProfileOrThrow(creatorProfileId);
    if (existing.status !== 'suspended') {
      throw new BadRequestException('Восстановить можно только приостановленного Creator');
    }

    await this.prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: { status: 'active', suspendedAt: null, suspendedReason: null },
    });
    await this.notifyStatusChange(existing.userId, 'active', 'Ваш статус Creator восстановлен.');
  }

  /** Создаёт (при первом обращении) Stripe Connect аккаунт creator'а и
   * возвращает ссылку на хостед-онбординг Stripe — реальные выплаты (Phase
   * 5, AI_PLATFORM_ROADMAP.md §83). Повторный вызов (аккаунт уже создан, но
   * онбординг не завершён/нужно продолжить) переиспользует существующий
   * `stripeConnectedAccountId`, не создаёт второй аккаунт. */
  async startStripeConnectOnboarding(userId: string): Promise<{ url: string }> {
    const profile = await this.requireProfile(userId);
    if (profile.status !== 'active') {
      throw new BadRequestException('Подключение выплат доступно только активному Creator');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const { accountId, url } = await this.stripeConnectService.createOnboardingLink(
      profile.stripeConnectedAccountId,
      user.email,
    );

    if (profile.stripeConnectStatus === 'not_connected') {
      await this.prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { stripeConnectedAccountId: accountId, stripeConnectStatus: 'onboarding' },
      });
    }

    return { url };
  }

  /** Живой опрос реального статуса у Stripe (см. `StripeConnectService`'s
   * комментарий про то, почему не вебхук) — обновляет локальный кэш-статус,
   * если он изменился. `not_connected`, если аккаунт ещё не создавался —
   * не бросает, честное состояние "ещё не начинал подключение". */
  async refreshStripeConnectStatus(userId: string): Promise<{ status: string }> {
    const profile = await this.requireProfile(userId);
    if (!profile.stripeConnectedAccountId) return { status: 'not_connected' };

    const status = await this.stripeConnectService.getAccountStatus(
      profile.stripeConnectedAccountId,
    );
    if (status !== profile.stripeConnectStatus) {
      await this.prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { stripeConnectStatus: status },
      });
    }
    return { status };
  }

  private async notifyStatusChange(
    userId: string,
    status: CreatorStatus,
    summary: string,
  ): Promise<void> {
    const { id: notificationId } = await this.notificationsService.notifyCreatorStatusChanged(
      userId,
      summary,
    );
    this.realtimeGateway.emitToUser(userId, 'creator:status-changed', { notificationId, status });
  }

  private async requireProfile(userId: string): Promise<CreatorProfile> {
    const profile = await this.prisma.creatorProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Вы ещё не начали регистрацию Creator');
    }
    return profile;
  }

  private async findProfileOrThrow(creatorProfileId: string): Promise<CreatorProfile> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Creator не найден');
    }
    return profile;
  }

  private toDto(profile: ProfileWithCategories): CreatorProfileDto {
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      rejectionReason: profile.rejectionReason,
      verifiedAt: profile.verifiedAt?.toISOString() ?? null,
      activatedAt: profile.activatedAt?.toISOString() ?? null,
      suspendedAt: profile.suspendedAt?.toISOString() ?? null,
      suspendedReason: profile.suspendedReason,
      monetizationEnabled: profile.monetizationEnabled,
      adFrequency: profile.adFrequency,
      maxAdFrequencyRatio: profile.maxAdFrequencyRatio,
      blockedCategories: profile.blockedCategories,
      blockedAdvertiserIds: profile.blockedAdvertiserIds,
      stripeConnectStatus: profile.stripeConnectStatus,
      categories: profile.categories.map((assignment) => ({
        id: assignment.id,
        slug: assignment.category.slug,
        label: assignment.category.label,
        isPrimary: assignment.isPrimary,
      })),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}

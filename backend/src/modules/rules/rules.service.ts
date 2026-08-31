import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Rule, RuleTrigger } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import type { CreateRuleDto } from './dto/create-rule.dto';
import type { UpdateRuleDto } from './dto/update-rule.dto';
import { evaluateConditions } from './rule-condition.lib';
import {
  buildRuleSummary,
  parseRuleActions,
  parseRuleCondition,
  type CustomerLoyaltyAccountDto,
  type RuleAction,
  type RuleDto,
} from './rules.types';

/** Сколько последних счетов лояльности отдавать владельцу — тот же
 * "мини"-лимит без курсорной пагинации, что у `PlanSelectionEventService`/
 * `AuditLogService`, не построено впрок под объём, которого сегодня нет. */
const LOYALTY_ACCOUNTS_LIMIT = 100;

/** `context.customerEmail` — поле, которое контроллеры (`PublicSitesController.
 * createOrder`/`createAppointment`) добавляют в context именно ради этих двух
 * действий (см. `RULE_TRIGGER_CONTEXT_FIELDS`'s комментарий в `rules.types.ts`)
 * — не гарантировано присутствовать (покупатель мог не указать email, или
 * триггер вообще не несёт его, например `form_submitted`), поэтому всегда
 * `string | null`, никогда не бросает. */
function getCustomerEmail(context: Record<string, unknown>): string | null {
  return typeof context.customerEmail === 'string' && context.customerEmail.length > 0
    ? context.customerEmail
    : null;
}

/**
 * Business Logic Engine v1 (AI_PLATFORM_ROADMAP.md §2.5, AI-5's первый
 * ограниченный слайс) — owner-CRUD правил (тот же паттерн, что
 * `DiscountsService`: `assertOwnership` на каждый вызов, `findOwnedRule` для
 * update/remove) плюс сам движок (`evaluate`), вызываемый КОНТРОЛЛЕРОМ после
 * реального доменного события — §2.5's явный принцип "Controller решает,
 * Service не знает", уже применяемый в проекте для Socket.IO-эмиссий (см.
 * `AGENTS.md` backend, "Real-time"). `evaluate` намеренно не бросает исключения
 * наружу — сбой правила (там, где действие упало) не должен ронять реальный
 * запрос, который его вызвал (тот же принцип, что `AnalyticsService.record`,
 * см. её комментарий в схеме `AnalyticsEvent`), только пишет `RuleExecutionLog`
 * с `error` для последующего разбора.
 */
@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(businessId: string, ownerId: string): Promise<RuleDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const rules = await this.prisma.rule.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return rules.map((rule) => this.toDto(rule));
  }

  async create(businessId: string, ownerId: string, dto: CreateRuleDto): Promise<RuleDto> {
    await this.assertOwnership(businessId, ownerId);
    const condition = parseRuleCondition(dto.condition);
    const actions = parseRuleActions(dto.actions);

    const rule = await this.prisma.rule.create({
      data: {
        businessId,
        name: dto.name,
        trigger: dto.trigger,
        condition: condition as never,
        actions: actions as never,
        isEnabled: dto.isEnabled ?? true,
      },
    });
    return this.toDto(rule);
  }

  async update(
    businessId: string,
    ruleId: string,
    ownerId: string,
    dto: UpdateRuleDto,
  ): Promise<RuleDto> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedRule(businessId, ruleId);

    const rule = await this.prisma.rule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.condition !== undefined
          ? { condition: parseRuleCondition(dto.condition) as never }
          : {}),
        ...(dto.actions !== undefined ? { actions: parseRuleActions(dto.actions) as never } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
      },
    });
    return this.toDto(rule);
  }

  async remove(businessId: string, ruleId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    await this.findOwnedRule(businessId, ruleId);
    await this.prisma.rule.delete({ where: { id: ruleId } });
  }

  /**
   * Вызывается контроллером ПОСЛЕ того, как реальное доменное событие уже
   * произошло и закоммичено (например, `PublicSitesController.createOrder`
   * после `OrdersService.createFromCart`) — сам движок ничего не мутирует в
   * исходной сущности, только читает применимые правила и выполняет их
   * действия. `context` — плоский (сегодня) объект полей события, см.
   * `RULE_TRIGGER_CONTEXT_FIELDS` в `rules.types.ts` про то, какие поля
   * доступны для каждого триггера.
   */
  async evaluate(
    trigger: RuleTrigger,
    businessId: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const rules = await this.prisma.rule.findMany({
      where: { businessId, trigger, isEnabled: true },
    });
    if (rules.length === 0) return;

    for (const rule of rules) {
      await this.evaluateOne(rule, context);
    }
  }

  private async evaluateOne(rule: Rule, context: Record<string, unknown>): Promise<void> {
    const condition = rule.condition as unknown as ReturnType<typeof parseRuleCondition>;
    const matched = evaluateConditions(condition, context);

    if (!matched) {
      await this.prisma.ruleExecutionLog.create({
        data: {
          ruleId: rule.id,
          businessId: rule.businessId,
          trigger: rule.trigger,
          matched: false,
        },
      });
      return;
    }

    const actions = rule.actions as unknown as RuleAction[];
    let error: string | undefined;
    try {
      await this.runActions(actions, rule.businessId, rule.trigger, context);
    } catch (actionError) {
      error = actionError instanceof Error ? actionError.message : String(actionError);
      this.logger.warn(`Правило ${rule.id} (${rule.name}): действие упало — ${error}`);
    }

    await this.prisma.ruleExecutionLog.create({
      data: {
        ruleId: rule.id,
        businessId: rule.businessId,
        trigger: rule.trigger,
        matched: true,
        actionsRun: actions as never,
        error: error ?? null,
      },
    });
  }

  /** `send_notification` уведомляет владельца бизнеса (`Business.ownerId`).
   * `add_loyalty_points`/`set_membership_tier` пишут в `CustomerLoyaltyAccount`,
   * идентифицируя покупателя по `context.customerEmail` (см. её комментарий
   * в schema.prisma) — если email в контексте нет (не указан в конкретном
   * заказе/записи, либо триггер вообще не несёт email, например
   * `form_submitted`), действие МОЛЧА пропускается: это ожидаемый, частый
   * случай, а не ошибка — `evaluateOne`'s try/catch существует для реальных
   * сбоев, не для "нечего делать". `trigger`/`context` — также нужны
   * `send_notification`'у, чтобы построить `Notification.summary` через
   * `buildRuleSummary`. */
  private async runActions(
    actions: RuleAction[],
    businessId: string,
    trigger: RuleTrigger,
    context: Record<string, unknown>,
  ): Promise<void> {
    for (const action of actions) {
      if (action.type === 'send_notification') {
        const business = await this.prisma.business.findUnique({
          where: { id: businessId },
          select: { ownerId: true },
        });
        if (!business)
          throw new Error(`Бизнес ${businessId} не найден при выполнении действия правила`);
        await this.notifications.notifyRuleTriggered(
          business.ownerId,
          businessId,
          buildRuleSummary(trigger, context),
        );
      } else if (action.type === 'add_loyalty_points') {
        const email = getCustomerEmail(context);
        if (!email) continue;
        await this.prisma.customerLoyaltyAccount.upsert({
          where: { businessId_email: { businessId, email } },
          create: { businessId, email, points: action.points },
          update: { points: { increment: action.points } },
        });
      } else if (action.type === 'set_membership_tier') {
        const email = getCustomerEmail(context);
        if (!email) continue;
        await this.prisma.customerLoyaltyAccount.upsert({
          where: { businessId_email: { businessId, email } },
          create: { businessId, email, tier: action.tier },
          update: { tier: action.tier },
        });
      }
    }
  }

  /** Владелец бизнеса просматривает накопленные баллы/тиры (§2.5's
   * `addLoyaltyPoints`/`setMembershipTier`, реализованы поверх
   * `CustomerLoyaltyAccount`) — отсортировано по баллам, самые "ценные"
   * покупатели первыми, тот же смысл, что и у любого списка лояльности. */
  async listLoyaltyAccounts(
    businessId: string,
    ownerId: string,
  ): Promise<CustomerLoyaltyAccountDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const accounts = await this.prisma.customerLoyaltyAccount.findMany({
      where: { businessId },
      orderBy: { points: 'desc' },
      take: LOYALTY_ACCOUNTS_LIMIT,
    });
    return accounts.map((account) => ({
      id: account.id,
      email: account.email,
      points: account.points,
      tier: account.tier,
      updatedAt: account.updatedAt.toISOString(),
    }));
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private async findOwnedRule(businessId: string, ruleId: string): Promise<Rule> {
    const rule = await this.prisma.rule.findFirst({ where: { id: ruleId, businessId } });
    if (!rule) throw new NotFoundException('Правило не найдено');
    return rule;
  }

  private toDto(rule: Rule): RuleDto {
    return {
      id: rule.id,
      businessId: rule.businessId,
      name: rule.name,
      trigger: rule.trigger,
      condition: rule.condition as unknown as RuleDto['condition'],
      actions: rule.actions as unknown as RuleDto['actions'],
      isEnabled: rule.isEnabled,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}

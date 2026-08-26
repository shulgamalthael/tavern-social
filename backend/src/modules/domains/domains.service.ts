import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Domain, Prisma } from '@prisma/client';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { DomainVerificationProvider } from './domain-verification.provider';
import type {
  ConnectDomainResultDto,
  DnsInstructionDto,
  DomainDto,
  DomainStatus,
} from './domains.types';
import {
  buildSystemSubdomain,
  isReservedSubdomain,
  isValidCustomDomain,
  normalizeHostname,
} from './lib/hostname';

type PrismaTx = Prisma.TransactionClient | PrismaService;

/**
 * Домены сайта — единственное место, которое пишет/читает таблицу `Domain`
 * (см. корневой план задачи: «Domain отвечает за адрес сайта», не Business/
 * Website напрямую). Владение всегда проверяется через цепочку
 * `Domain → Website → Business.ownerId` (см. `findOwnedWebsiteId`) — тот же
 * принцип 404-не-403 для чужого, что и у `BusinessesService`/`WebsitesService`.
 */
@Injectable()
export class DomainsService {
  private readonly baseDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationProvider: DomainVerificationProvider,
    configService: ConfigService,
  ) {
    this.baseDomain = configService.get<AppConfig>('app')!.sitesBaseDomain;
  }

  async list(businessId: string, ownerId: string): Promise<DomainDto[]> {
    const websiteId = await this.findOwnedWebsiteId(businessId, ownerId);
    const domains = await this.prisma.domain.findMany({
      where: { websiteId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return domains.map((domain) => this.toDto(domain));
  }

  /** Вызывается только изнутри — при создании бизнеса и при смене slug (см.
   * `BusinessesService`), никогда напрямую с frontend: у системного домена
   * нет отдельного пользовательского действия «создать», он всегда следствие
   * бизнес-события. `tx` — тот же клиент транзакции, что и у вызывающего
   * кода (создание бизнеса+сайта+домена — одна атомарная операция). */
  async createSystemDomain(tx: PrismaTx, websiteId: string, slug: string): Promise<void> {
    const hostname = await this.resolveFreeSystemHostname(tx, slug);
    await tx.domain.create({
      data: {
        websiteId,
        hostname,
        type: 'SYSTEM_SUBDOMAIN',
        isPrimary: true,
        isVerified: true,
      },
    });
  }

  /** При смене slug бизнеса старый системный домен НЕ удаляется и не
   * переименовывается на месте (см. корневой план задачи: «если slug
   * изменился — не ломай существующий сайт») — вместо этого заводится новый
   * системный домен с новым hostname и становится primary, а старый остаётся
   * рабочим алиасом (просто теряет пометку primary). Полноценный 301 с
   * алиаса на новый primary — задача на будущее (см. план, раздел «Primary
   * domain»), сейчас оба хоста одинаково показывают один и тот же сайт. */
  async handleSlugChanged(tx: PrismaTx, websiteId: string, newSlug: string): Promise<void> {
    const newHostname = await this.resolveFreeSystemHostname(tx, newSlug);

    const currentPrimarySystemDomain = await tx.domain.findFirst({
      where: { websiteId, type: 'SYSTEM_SUBDOMAIN', isPrimary: true },
    });
    if (currentPrimarySystemDomain?.hostname === newHostname) return;

    await tx.domain.create({
      data: {
        websiteId,
        hostname: newHostname,
        type: 'SYSTEM_SUBDOMAIN',
        isPrimary: true,
        isVerified: true,
      },
    });

    if (currentPrimarySystemDomain) {
      await tx.domain.update({
        where: { id: currentPrimarySystemDomain.id },
        data: { isPrimary: false },
      });
    }
  }

  async connectCustomDomain(
    businessId: string,
    ownerId: string,
    rawHostname: string,
  ): Promise<ConnectDomainResultDto> {
    const websiteId = await this.findOwnedWebsiteId(businessId, ownerId);
    const hostname = normalizeHostname(rawHostname);

    if (!isValidCustomDomain(hostname)) {
      throw new BadRequestException('Введите корректный домен, например example.com');
    }
    if (hostname === this.baseDomain || hostname.endsWith(`.${this.baseDomain}`)) {
      throw new BadRequestException('Этот домен зарезервирован под системные адреса сайтов');
    }

    const existing = await this.prisma.domain.findUnique({ where: { hostname } });
    if (existing) {
      throw new ConflictException('Этот домен уже подключён к другому сайту');
    }

    const verificationToken = randomBytes(16).toString('hex');
    const domain = await this.prisma.domain.create({
      data: {
        websiteId,
        hostname,
        type: 'CUSTOM_DOMAIN',
        isPrimary: false,
        isVerified: false,
        verificationToken,
      },
    });

    return {
      domain: this.toDto(domain),
      instructions: this.buildDnsInstructions(hostname, verificationToken),
    };
  }

  /** Инструкции считаются на лету из уже сохранённых `hostname`/
   * `verificationToken` (см. `buildDnsInstructions`), а не хранятся в БД —
   * позволяет показать их повторно в любой момент, пока домен не подтверждён
   * (например, пользователь закрыл модалку подключения и вернулся позже),
   * без отдельной таблицы/поля под них. Для `SYSTEM_SUBDOMAIN` и уже
   * подтверждённого `CUSTOM_DOMAIN` инструкции не нужны — пустой список. */
  async getInstructions(
    businessId: string,
    ownerId: string,
    domainId: string,
  ): Promise<DnsInstructionDto[]> {
    const websiteId = await this.findOwnedWebsiteId(businessId, ownerId);
    const domain = await this.findOwnedDomain(websiteId, domainId);

    if (domain.type !== 'CUSTOM_DOMAIN' || !domain.verificationToken || domain.isVerified) {
      return [];
    }
    return this.buildDnsInstructions(domain.hostname, domain.verificationToken);
  }

  async verify(businessId: string, ownerId: string, domainId: string): Promise<DomainDto> {
    const websiteId = await this.findOwnedWebsiteId(businessId, ownerId);
    const domain = await this.findOwnedDomain(websiteId, domainId);

    if (domain.type !== 'CUSTOM_DOMAIN' || !domain.verificationToken) {
      return this.toDto(domain);
    }
    if (domain.isVerified) {
      return this.toDto(domain);
    }

    const isVerified = await this.verificationProvider.verify(
      domain.hostname,
      domain.verificationToken,
    );
    if (!isVerified) {
      return this.toDto(domain);
    }

    const updated = await this.prisma.domain.update({
      where: { id: domain.id },
      data: { isVerified: true },
    });
    return this.toDto(updated);
  }

  /** Только подтверждённый домен может стать primary — иначе UI показывал
   * бы канонический адрес сайта, который на самом деле никуда не ведёт
   * (пользователь ещё не донастроил DNS). На резолвинг (кто отвечает на
   * запрос) это не влияет — резолвятся все домены сайта одинаково, primary
   * только про то, какой адрес показывать как «основной» в интерфейсе. */
  async setPrimary(businessId: string, ownerId: string, domainId: string): Promise<DomainDto[]> {
    const websiteId = await this.findOwnedWebsiteId(businessId, ownerId);
    const domain = await this.findOwnedDomain(websiteId, domainId);

    if (!domain.isVerified) {
      throw new BadRequestException('Домен ещё не подтверждён');
    }

    await this.prisma.$transaction([
      this.prisma.domain.updateMany({
        where: { websiteId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.domain.update({ where: { id: domain.id }, data: { isPrimary: true } }),
    ]);

    return this.list(businessId, ownerId);
  }

  /** Системный сабдомен нельзя удалить — это гарантированный fallback-адрес
   * сайта (см. корневой план задачи: у сайта всегда должен быть рабочий
   * адрес без настройки DNS пользователем). Удалить можно только
   * `CUSTOM_DOMAIN`. */
  async remove(businessId: string, ownerId: string, domainId: string): Promise<DomainDto[]> {
    const websiteId = await this.findOwnedWebsiteId(businessId, ownerId);
    const domain = await this.findOwnedDomain(websiteId, domainId);

    if (domain.type === 'SYSTEM_SUBDOMAIN') {
      throw new ForbiddenException('Системный адрес сайта нельзя удалить');
    }

    await this.prisma.domain.delete({ where: { id: domain.id } });
    return this.list(businessId, ownerId);
  }

  private buildDnsInstructions(hostname: string, verificationToken: string): DnsInstructionDto[] {
    const label = hostname.split('.').length > 2 ? hostname.split('.')[0] : 'www';
    return [
      {
        type: 'CNAME',
        name: label,
        value: this.baseDomain,
        description: `Направляет ${hostname} на инфраструктуру сайтов Таверны.`,
      },
      {
        type: 'TXT',
        name: `_tavern-verify.${hostname}`,
        value: verificationToken,
        description: 'Подтверждает, что домен действительно принадлежит вам.',
      },
    ];
  }

  private async resolveFreeSystemHostname(tx: PrismaTx, slug: string): Promise<string> {
    const slugBase = isReservedSubdomain(slug) ? `site-${slug}` : slug;
    const base = buildSystemSubdomain(slugBase, this.baseDomain);
    return this.firstFreeHostname(tx, slugBase, this.baseDomain, base);
  }

  private async firstFreeHostname(
    tx: PrismaTx,
    slugBase: string,
    baseDomain: string,
    precomputed?: string,
  ): Promise<string> {
    const MAX_ATTEMPTS = 30;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const candidate =
        attempt === 0 && precomputed
          ? precomputed
          : buildSystemSubdomain(`${slugBase}-${attempt + 1}`, baseDomain);
      const existing = await tx.domain.findUnique({ where: { hostname: candidate } });
      if (!existing) return candidate;
    }
    return buildSystemSubdomain(`${slugBase}-${Date.now()}`, baseDomain);
  }

  private async findOwnedWebsiteId(businessId: string, ownerId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true, website: { select: { id: true } } },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
    if (!business.website) throw new NotFoundException('Сайт не найден');
    return business.website.id;
  }

  private async findOwnedDomain(websiteId: string, domainId: string): Promise<Domain> {
    const domain = await this.prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain || domain.websiteId !== websiteId) {
      throw new NotFoundException('Домен не найден');
    }
    return domain;
  }

  private toDto(domain: Domain): DomainDto {
    return {
      id: domain.id,
      hostname: domain.hostname,
      type: domain.type,
      isPrimary: domain.isPrimary,
      isVerified: domain.isVerified,
      status: this.toStatus(domain),
      createdAt: domain.createdAt.toISOString(),
    };
  }

  private toStatus(domain: Domain): DomainStatus {
    if (domain.type === 'SYSTEM_SUBDOMAIN') return 'system';
    return domain.isVerified ? 'verified' : 'pending';
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { normalizeHostname } from './lib/hostname';

export interface ResolvedDomain {
  websiteId: string;
  businessId: string;
}

/**
 * Единственная точка «hostname → сайт» во всём приложении (см. корневой план
 * задачи, раздел «Domain Resolver») — вызывается на каждый запрос к
 * публичному сайту (Next.js middleware, см. `frontend/src/proxy.ts`), но
 * НЕ используется билдером/рендерером напрямую: они всегда работают с уже
 * известным `businessId` (см. план, «Builder/Renderer НЕ должны знать о
 * домене»). Разделение с `WebsitesService`/`BusinessesService` намеренное —
 * этот сервис ничего не знает о содержимом сайта, только «чей это хост».
 *
 * Без кэша — сознательное упрощение MVP (см. план, раздел «Caching»):
 * `Domain.hostname` уже уникально проиндексировано, а нагрузка публичных
 * сайтов пока не настолько велика, чтобы один индексированный lookup на
 * запрос был проблемой. Кэш (in-memory LRU или Redis) можно добавить сюда
 * позже, не трогая ничьих вызовов этого метода.
 */
@Injectable()
export class DomainResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(rawHostname: string): Promise<ResolvedDomain | null> {
    const hostname = normalizeHostname(rawHostname);
    if (!hostname) return null;

    const domain = await this.prisma.domain.findUnique({
      where: { hostname },
      select: { websiteId: true, website: { select: { businessId: true } } },
    });
    if (!domain) return null;

    return { websiteId: domain.websiteId, businessId: domain.website.businessId };
  }
}

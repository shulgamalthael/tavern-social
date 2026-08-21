import { Injectable } from '@nestjs/common';
import type { LinkPreview } from '@prisma/client';
import { extractLinks, fetchLinkMetadata } from '@/common/lib/link-preview';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { LinkPreviewDto } from './posts.types';

/** Успешно полученное превью переиспользуется дольше, чем неудачная попытка
 * — не долбим постоянно недоступную ссылку на каждое сохранение поста, но и
 * не держим временный сбой закэшированным сутками. */
const SUCCESS_REUSE_MS = 24 * 60 * 60 * 1000;
const FAILURE_REUSE_MS = 60 * 60 * 1000;

/**
 * Резолвит превью для ссылок, найденных в санитизированном контенте поста —
 * кэш в `LinkPreview` по `url`, общий между всеми постами, ссылающимися на
 * один и тот же адрес. Никогда не бросает: ссылка без превью — не ошибка,
 * публикация поста не зависит от доступности стороннего сайта.
 */
@Injectable()
export class LinkPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForContent(html: string): Promise<LinkPreviewDto[]> {
    const urls = extractLinks(html);
    if (urls.length === 0) return [];

    const previews = await Promise.all(urls.map((url) => this.resolveOne(url)));
    return previews.filter((preview): preview is LinkPreviewDto => preview !== null);
  }

  /** Только чтение кэша, без сетевых запросов — для листинга ленты/стены
   * (`PostsService.toDto`/`toSummaryDto`), чтобы рендер списка постов не бил
   * по сети на каждый запрос. Ссылка без кэшированного превью просто не
   * попадает в результат (см. `resolveForContent`, который и заполняет кэш
   * при создании/редактировании поста). */
  async getCachedForContent(html: string): Promise<LinkPreviewDto[]> {
    const urls = extractLinks(html);
    if (urls.length === 0) return [];

    const cached = await this.prisma.linkPreview.findMany({
      where: { url: { in: urls }, status: 'ok' },
    });
    const byUrl = new Map(cached.map((preview) => [preview.url, preview]));

    return urls
      .map((url) => byUrl.get(url))
      .filter((preview): preview is LinkPreview => Boolean(preview))
      .map((preview) => this.toDto(preview));
  }

  private async resolveOne(url: string): Promise<LinkPreviewDto | null> {
    const cached = await this.prisma.linkPreview.findUnique({ where: { url } });
    const reuseWindowMs = cached?.status === 'ok' ? SUCCESS_REUSE_MS : FAILURE_REUSE_MS;
    if (cached && Date.now() - cached.fetchedAt.getTime() < reuseWindowMs) {
      return cached.status === 'ok' ? this.toDto(cached) : null;
    }

    const metadata = await fetchLinkMetadata(url);
    const data = {
      status: metadata ? 'ok' : 'failed',
      title: metadata?.title ?? null,
      description: metadata?.description ?? null,
      imageUrl: metadata?.imageUrl ?? null,
      domain: metadata?.domain ?? null,
    };
    const saved = await this.prisma.linkPreview.upsert({
      where: { url },
      create: { url, ...data },
      update: { ...data, fetchedAt: new Date() },
    });

    return saved.status === 'ok' ? this.toDto(saved) : null;
  }

  private toDto(preview: LinkPreview): LinkPreviewDto {
    return {
      url: preview.url,
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      domain: preview.domain,
    };
  }
}

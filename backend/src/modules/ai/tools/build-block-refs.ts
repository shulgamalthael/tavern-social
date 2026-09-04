import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import type { WebsitePage } from '@/modules/websites/websites.types';
import { BLOCK_SCHEMAS, schemaNeedsRefs, type AllowedBlockType } from './lib/add-block-schemas';
import type { BuildValidatedPropsRefs } from './lib/add-block-schemas';

/** Производится из самой схемы блока (`schemaNeedsRefs`, `add-block-
 * schemas.ts`) — есть ли где угодно в её полях (включая рекурсивно внутри
 * `list.itemFields`) `linkTarget`/`mediaAsset` — а не захардкоженный список
 * типов: список типов с такими полями рос вместе с allowlist (изначально
 * только `image`/`button`, теперь большинство блоков — `hero`/`cards`/
 * `team`/меню и т.п.), и ручной список неизбежно рассинхронился бы при
 * следующем добавленном блоке. Вызывается из `AddBlockTool`/
 * `UpdateBlockPropsTool` перед `buildBlockRefs`, чтобы не тратить запросы на
 * `heading`/`text`/`quote`/`spacer` и другие блоки без таких полей. */
export function needsBlockRefs(blockType: AllowedBlockType): boolean {
  return schemaNeedsRefs(BLOCK_SCHEMAS[blockType]);
}

/**
 * Собирает множества id/URL для `linkTarget`/`mediaAsset` полей —
 * вызывается из `AddBlockTool`/`UpdateBlockPropsTool` ТОЛЬКО когда
 * `needsBlockRefs(blockType)` вернул `true` (не тратим запросы на блоки,
 * которым это никогда не нужно). Прямой Prisma для продуктов/услуг (лёгкая
 * проверка существования, не полноценное чтение через `ProductsService`/
 * `ServicesService` с их DTO-маппингом) — тот же принцип, что у
 * `BillingService`/`RulesService`'s инлайн-проверок владения: не заводить
 * зависимость от чужого модуля ради одной выборки id.
 */
export async function buildBlockRefs(
  prisma: PrismaService,
  mediaAssetsService: MediaAssetsService,
  businessId: string,
  ownerId: string,
  pages: WebsitePage[],
): Promise<BuildValidatedPropsRefs> {
  const [products, services, mediaAssets] = await Promise.all([
    prisma.product.findMany({ where: { businessId }, select: { id: true } }),
    prisma.service.findMany({ where: { businessId }, select: { id: true } }),
    mediaAssetsService.list(businessId, ownerId),
  ]);

  return {
    pageIds: new Set(pages.map((page) => page.id)),
    productIds: new Set(products.map((product) => product.id)),
    serviceIds: new Set(services.map((service) => service.id)),
    mediaAssetUrls: new Set(mediaAssets.map((asset) => asset.url)),
  };
}

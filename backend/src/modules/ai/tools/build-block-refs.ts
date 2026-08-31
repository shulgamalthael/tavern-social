import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import type { WebsitePage } from '@/modules/websites/websites.types';
import type { AllowedBlockType, BuildValidatedPropsRefs } from './lib/add-block-schemas';

/** `image`/`button` — единственные типы, чьи поля (`mediaAsset`/`linkTarget`)
 * нуждаются в `BuildValidatedPropsRefs` — вызывается из `AddBlockTool`/
 * `UpdateBlockPropsTool` перед `buildBlockRefs`, чтобы не тратить запросы на
 * `heading`/`text`/`quote`/`spacer`, которым это не нужно вообще. */
export function needsBlockRefs(blockType: AllowedBlockType): boolean {
  return blockType === 'image' || blockType === 'button';
}

/**
 * Собирает множества id/URL для `linkTarget`/`mediaAsset` полей
 * `image`/`button` (`add-block-schemas.ts`) — только эти два типа блока их
 * используют, поэтому вызывается из `AddBlockTool`/`UpdateBlockPropsTool`
 * ТОЛЬКО когда `blockType` реально `image`/`button`, не на каждый вызов
 * инструмента (не тратим запросы на `heading`/`text`/`quote`/`spacer`,
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

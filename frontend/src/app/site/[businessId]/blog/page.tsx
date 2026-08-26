import type { Metadata } from 'next';
import { getAnonymousPublicSite, resolveSiteMetadataDefaults } from '@/entities/website';
import { BlogListWidget } from '@/widgets/public-site';

interface BlogListPageProps {
  params: Promise<{ businessId: string }>;
}

/** См. `BlogListWidget` для полного обоснования — отдельный физический
 * маршрут для блога, не через обычную систему страниц сайта. Без своего
 * `seoTitle`/`seoDescription` — список постов не адресует одну сущность,
 * которой имело бы смысл дать собственное переопределение (в отличие от
 * `WebsitePage`/`BlogPost`, см. ROADMAP.md §3.11/§8 Phase 10), поэтому
 * описание и OG-картинка берутся напрямую из фолбэков сайта. */
export async function generateMetadata({ params }: BlogListPageProps): Promise<Metadata> {
  const { businessId } = await params;
  try {
    const site = await getAnonymousPublicSite(businessId);
    const defaults = resolveSiteMetadataDefaults(site);
    const title = `Блог — ${defaults.siteTitle}`;

    return {
      title,
      description: defaults.siteDescription,
      openGraph: {
        title,
        description: defaults.siteDescription,
        images: defaults.ogImage ? [{ url: defaults.ogImage }] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function BlogListPage({ params }: BlogListPageProps) {
  const { businessId } = await params;
  return <BlogListWidget businessId={businessId} />;
}

import type { Metadata } from 'next';
import { getPublicBlogPostBySlug } from '@/entities/blog-post';
import { getAnonymousPublicSite, resolveSiteMetadataDefaults } from '@/entities/website';
import { BlogPostWidget } from '@/widgets/public-site';

interface BlogPostPageProps {
  params: Promise<{ businessId: string; postSlug: string }>;
}

/** См. `BlogPostWidget` для полного обоснования маршрута. `post.seoTitle`/
 * `seoDescription` (см. ROADMAP.md §3.11/§8 Phase 10), если заданы,
 * переопределяют `title`/`excerpt` целиком — тот же принцип, что и у
 * `WebsitePage.seoTitle` в каталожном маршруте: явное значение владельца
 * используется как есть, не склеивается с чем-то ещё. OG-картинка —
 * обложка поста, если есть, иначе логотип бизнеса (см.
 * `resolveSiteMetadataDefaults`). */
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { businessId, postSlug } = await params;
  try {
    const [site, post] = await Promise.all([
      getAnonymousPublicSite(businessId),
      getPublicBlogPostBySlug(businessId, postSlug),
    ]);
    const defaults = resolveSiteMetadataDefaults(site);

    const title = post
      ? (post.seoTitle ?? `${post.title} — ${defaults.siteTitle}`)
      : defaults.siteTitle;
    const description = post
      ? (post.seoDescription ?? post.excerpt) || undefined
      : defaults.siteDescription;
    const ogImage = post?.coverImage || defaults.ogImage;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: ogImage ? [{ url: ogImage }] : undefined,
      },
    };
  } catch {
    return {};
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { businessId, postSlug } = await params;
  return <BlogPostWidget businessId={businessId} postSlug={postSlug} />;
}

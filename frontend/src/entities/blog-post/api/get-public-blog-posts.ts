'use server';

import { backendFetch } from '@/shared/lib/backend-client';
import type { PublicBlogPost } from '../model/types';

/** По-настоящему анонимно — см. `getPublicProducts`/`getPublicServices`,
 * тот же принцип. */
export async function getPublicBlogPosts(businessId: string): Promise<PublicBlogPost[]> {
  return backendFetch<PublicBlogPost[]>(`/sites/${businessId}/blog-posts`);
}

/** Первая сущность капабилити Booking (см. ROADMAP.md §2.2/§8 Phase 6) —
 * сознательно узкий v1, зеркальный `Product`: без `Employee`/`ServiceCategory`/
 * `Location` (см. комментарий модели `Service` в backend schema.prisma). */
export interface Service {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  images: string[];
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicService {
  id: string;
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  images: string[];
}

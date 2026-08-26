export interface ServiceDto {
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

/** Публичная витрина — см. `PublicProductDto` (тот же приём разделения
 * владелец/публика: без `businessId`/`order`, только активные услуги). */
export interface PublicServiceDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  images: string[];
}

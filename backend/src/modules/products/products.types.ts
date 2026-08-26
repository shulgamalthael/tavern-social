export interface ProductDto {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: string;
  images: string[];
  stock: number | null;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Публичная витрина (`PublicSitesController`) не должна отдавать анонимному
 * посетителю ничего лишнего — `businessId` он и так знает из URL, `order`
 * не его дело (это внутренняя сортировка владельца, реально применённая
 * на сервере, а не подсказка для клиента). Отдельный тип, а не `ProductDto`
 * с опциональными полями — тот же принцип разделения владелец/публика, что
 * уже применён у `WebsitePublicDto.business` vs полного профиля бизнеса. */
export interface PublicProductDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: string;
  images: string[];
  stock: number | null;
}

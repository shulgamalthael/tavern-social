export interface CartItem {
  productId: string;
  name: string;
  priceCents: number;
  currency: string;
  image: string | null;
  quantity: number;
}

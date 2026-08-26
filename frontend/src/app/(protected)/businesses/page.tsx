import type { Metadata } from 'next';
import { BusinessesWidget } from '@/widgets/businesses';

export const metadata: Metadata = {
  title: 'Бизнесы — Таверна',
  description: 'Ваши бизнесы и их сайты.',
};

/**
 * Отдельный маршрут, не раздел SPA (см. `widgets/navigation-dock/ui/
 * NavigationDock.tsx`, пункт «Бизнесы» — обычная ссылка, а не `goToSection`)
 * — тот же приём, что и у `/admin`. Авторизация уже проверена общим
 * `(protected)/layout.tsx`, здесь не нужен дополнительный рубеж — в отличие
 * от `/admin`, тут нет ролевых ограничений, доступно любому пользователю.
 */
export default function BusinessesPage() {
  return <BusinessesWidget />;
}

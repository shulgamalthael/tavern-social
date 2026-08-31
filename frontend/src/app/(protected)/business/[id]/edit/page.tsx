import { redirect } from 'next/navigation';
import { getBillingStatus } from '@/entities/subscription';
import { WebsiteBuilderWidget } from '@/widgets/website-builder';

interface BusinessEditPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}

/**
 * Payment Plans v1 — жёсткий гейт конструктора: без выбранного тарифа
 * (`BillingStatus.isGateOpen === false`, см. `BillingService.getStatus`)
 * редиректит на `/business/[id]/plan` ДО рендера `WebsiteBuilderWidget`.
 * Проверка серверная (Server Component), не клиентская — иначе прямой
 * переход по URL успел бы отдать HTML билдера раньше, чем сработал бы
 * client-side редирект. `template` прокидывается в редирект, чтобы AI-
 * онбординг (см. `NewBusinessFlow`) не терял выбранный стартовый шаблон,
 * пока владелец проходит гейт.
 */
export default async function BusinessEditPage({ params, searchParams }: BusinessEditPageProps) {
  const { id } = await params;
  const { template } = await searchParams;

  const billing = await getBillingStatus(id);
  if (!billing.isGateOpen) {
    redirect(`/business/${id}/plan${template ? `?template=${encodeURIComponent(template)}` : ''}`);
  }

  return <WebsiteBuilderWidget businessId={id} />;
}

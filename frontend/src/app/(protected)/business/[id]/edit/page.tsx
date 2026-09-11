import { redirect } from 'next/navigation';
import { getBusiness } from '@/entities/business';
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
 *
 * Внешний рекламодатель (`Business.isAdvertiserOnly`, AI_PLATFORM_ROADMAP.md
 * §71) сюда попасть не должен вообще — у него нет причины редактировать
 * сайт (тот навсегда остаётся пустым черновиком). Проверяется ДО биллинг-
 * гейта, а не после: у такого бизнеса нет `BusinessSubscription`, так что
 * без этой ветки он бы просто улетал на `/plan` вместо честного возврата в
 * свой дашборд.
 */
export default async function BusinessEditPage({ params, searchParams }: BusinessEditPageProps) {
  const { id } = await params;
  const { template } = await searchParams;

  const business = await getBusiness(id);
  if (business.isAdvertiserOnly) {
    redirect(`/business/${id}/dashboard`);
  }

  const billing = await getBillingStatus(id);
  if (!billing.isGateOpen) {
    redirect(`/business/${id}/plan${template ? `?template=${encodeURIComponent(template)}` : ''}`);
  }

  return <WebsiteBuilderWidget businessId={id} />;
}

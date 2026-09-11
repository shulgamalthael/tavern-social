import { redirect } from 'next/navigation';
import { getBusiness } from '@/entities/business';
import { PlanSelectorWidget } from '@/widgets/plan-selector';

interface BusinessPlanPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string; checkout?: string }>;
}

/** Внешний рекламодатель (`Business.isAdvertiserOnly`) не выбирает тариф —
 * см. тот же гейт в `/business/[id]/edit/page.tsx`. */
export default async function BusinessPlanPage({ params, searchParams }: BusinessPlanPageProps) {
  const { id } = await params;
  const { template, checkout } = await searchParams;

  const business = await getBusiness(id);
  if (business.isAdvertiserOnly) {
    redirect(`/business/${id}/dashboard`);
  }

  return (
    <PlanSelectorWidget
      businessId={id}
      redirectTemplate={template}
      initialCheckoutState={checkout === 'success' || checkout === 'cancel' ? checkout : undefined}
    />
  );
}

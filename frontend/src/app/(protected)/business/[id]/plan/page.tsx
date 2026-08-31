import { PlanSelectorWidget } from '@/widgets/plan-selector';

interface BusinessPlanPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string; checkout?: string }>;
}

export default async function BusinessPlanPage({ params, searchParams }: BusinessPlanPageProps) {
  const { id } = await params;
  const { template, checkout } = await searchParams;

  return (
    <PlanSelectorWidget
      businessId={id}
      redirectTemplate={template}
      initialCheckoutState={checkout === 'success' || checkout === 'cancel' ? checkout : undefined}
    />
  );
}

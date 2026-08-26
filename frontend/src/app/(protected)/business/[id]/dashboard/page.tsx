import { BusinessDashboardWidget } from '@/widgets/business-dashboard';

interface BusinessDashboardPageProps {
  params: Promise<{ id: string }>;
}

export default async function BusinessDashboardPage({ params }: BusinessDashboardPageProps) {
  const { id } = await params;
  return <BusinessDashboardWidget businessId={id} />;
}

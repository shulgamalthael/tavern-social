import { BusinessSettingsWidget } from '@/widgets/business-settings';

interface BusinessSettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function BusinessSettingsPage({ params }: BusinessSettingsPageProps) {
  const { id } = await params;
  return <BusinessSettingsWidget businessId={id} />;
}

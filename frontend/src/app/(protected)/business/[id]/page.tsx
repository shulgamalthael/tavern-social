import { BusinessPageWidget } from '@/widgets/business';

interface BusinessPageProps {
  params: Promise<{ id: string }>;
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { id } = await params;
  return <BusinessPageWidget businessId={id} />;
}

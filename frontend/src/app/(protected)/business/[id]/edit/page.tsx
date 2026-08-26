import { WebsiteBuilderWidget } from '@/widgets/website-builder';

interface BusinessEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function BusinessEditPage({ params }: BusinessEditPageProps) {
  const { id } = await params;
  return <WebsiteBuilderWidget businessId={id} />;
}

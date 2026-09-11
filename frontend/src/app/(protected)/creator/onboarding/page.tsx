import type { Metadata } from 'next';
import { CreatorOnboardingWidget } from '@/widgets/creator-onboarding';

export const metadata: Metadata = {
  title: 'Стать блогером — Таверна',
  description: 'Подключите монетизацию: выберите категорию и подтвердите личность.',
};

export default function CreatorOnboardingPage() {
  return <CreatorOnboardingWidget />;
}

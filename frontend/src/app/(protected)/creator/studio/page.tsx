import type { Metadata } from 'next';
import { CreatorStudioWidget } from '@/widgets/creator-studio';

export const metadata: Metadata = {
  title: 'Creator Studio — Таверна',
  description: 'Доход, реклама, аудитория и настройки монетизации.',
};

export default function CreatorStudioPage() {
  return <CreatorStudioWidget />;
}

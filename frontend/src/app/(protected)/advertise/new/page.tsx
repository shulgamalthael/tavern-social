import type { Metadata } from 'next';
import { AdvertiserSignupFlow } from '@/widgets/businesses';

export const metadata: Metadata = {
  title: 'Кабинет рекламодателя — Таверна',
  description: 'Создайте кабинет рекламодателя и запустите первую кампанию.',
};

export default function AdvertiserSignupPage() {
  return <AdvertiserSignupFlow />;
}

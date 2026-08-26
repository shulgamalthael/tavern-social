import type { Metadata } from 'next';
import { CreateBusinessForm } from '@/widgets/businesses';

export const metadata: Metadata = {
  title: 'Новый бизнес — Таверна',
  description: 'Создайте бизнес и соберите для него сайт.',
};

export default function NewBusinessPage() {
  return <CreateBusinessForm />;
}

'use client';

import Link from 'next/link';
import { BackIcon } from '@/shared/ui/icons';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { AdvertiserSignupForm } from './AdvertiserSignupForm';
// Тот же `.section`/`.top`/`.back`, что у `NewBusinessFlow` — здесь нет
// переключателя режима (`.modes`/`.mode`), поэтому не нужен весь файл, а
// не только часть классов.
import styles from './NewBusinessFlow.module.scss';

/**
 * `/advertise/new` (AI_PLATFORM_ROADMAP.md §71) — тонкая шапка + форма, тот
 * же принцип разделения, что и `NewBusinessFlow`/`CreateBusinessForm`, но
 * без AI/ручного переключателя: у рекламодателя один-единственный путь.
 */
export function AdvertiserSignupFlow() {
  return (
    <SectionContainer narrow className={styles.section}>
      <div className={styles.top}>
        <Link href="/advertise" className={styles.back} aria-label="Назад">
          <BackIcon />
        </Link>
        <PageHead
          title="Кабинет рекламодателя"
          description="Пара слов о вас — дальше сразу к созданию кампании"
        />
      </div>

      <AdvertiserSignupForm />
    </SectionContainer>
  );
}

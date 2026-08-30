'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AiOnboardingChat } from '@/features/ai-onboarding';
import { cn } from '@/shared/lib/cn';
import { BackIcon } from '@/shared/ui/icons';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import { CreateBusinessForm } from './CreateBusinessForm';
import styles from './NewBusinessFlow.module.scss';

type CreateMode = 'ai' | 'manual';

const MODES: Array<{ id: CreateMode; label: string }> = [
  { id: 'ai', label: 'С помощью AI' },
  { id: 'manual', label: 'Вручную' },
];

/**
 * `/businesses/new` (AI-4, "Conversational onboarding", AI_PLATFORM_
 * ROADMAP.md §2.7) — владеет шапкой раздела (единственный `<main>` через
 * `SectionContainer`, единственный назад-линк) и переключателем режима
 * создания бизнеса: диалог с AI (`AiOnboardingChat`, по умолчанию) или
 * прежняя ручная форма (`CreateBusinessForm`, теперь без собственной шапки —
 * см. её комментарий). AI-режим по умолчанию, а не ручной, — сам мission
 * §2.7 формулирует это как "форма становится fallback/advanced-путём", не
 * наоборот; ручной режим никуда не делся, доступен тем же переключателем.
 */
export function NewBusinessFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<CreateMode>('ai');

  return (
    <SectionContainer narrow className={styles.section}>
      <div className={styles.top}>
        <Link href="/businesses" className={styles.back} aria-label="Назад к бизнесам">
          <BackIcon />
        </Link>
        <PageHead title="Новый бизнес" description="Пара слов — остальное донастроите на месте" />
      </div>

      <div className={styles.modes} role="tablist" aria-label="Способ создания бизнеса">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            className={cn(styles.mode, mode === item.id && styles['mode--active'])}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {mode === 'ai' ? (
        <AiOnboardingChat
          onBusinessCreated={(businessId) => router.push(`/business/${businessId}/edit`)}
        />
      ) : (
        <CreateBusinessForm />
      )}
    </SectionContainer>
  );
}

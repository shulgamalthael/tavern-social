import type { Metadata } from 'next';
import Link from 'next/link';
// session.server.ts не реэкспортируется из features/auth/index.ts (см.
// AGENTS.md, раздел про auth) — прямой импорт, тот же приём, что и
// `(protected)/admin/page.tsx`.
// eslint-disable-next-line no-restricted-imports
import { getSessionUser } from '@/features/auth/api/session.server';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'Реклама на Таверне',
  description:
    'Разместите рекламную кампанию на сайтах бизнесов Таверны — самостоятельно, без менеджера.',
};

const STEPS = [
  {
    title: 'Создайте кабинет рекламодателя',
    description: 'Только название и категория — сайт вам для этого не нужен.',
  },
  {
    title: 'Настройте кампанию и загрузите креатив',
    description: 'Бюджет, ставка за показы или за клики, места размещения и категории аудитории.',
  },
  {
    title: 'Оплатите — модерация включит показ',
    description: 'После проверки администратором кампания начинает показываться на сайтах Таверны.',
  },
];

/**
 * Публичная посадочная страница для внешних рекламодателей (без сайта на
 * платформе, AI_PLATFORM_ROADMAP.md §71) — единственная public-страница в
 * проекте, кроме `/auth` (см. `proxy.ts`'s `PUBLIC_PATHS`). CTA ведёт в
 * `/advertise/new`, если сессия уже есть (`getSessionUser()`, тот же вызов,
 * что и в `(protected)/admin/page.tsx`, обёрнут в try/catch — забаненный/
 * невалидный токен здесь не должен ронять страницу, просто ведёт как
 * анонимного), иначе на `/auth` — возврата после входа на `/advertise/new`
 * нет (в проекте вообще нет механизма "вернуться туда, откуда пришёл" после
 * входа, см. `features/auth/api/actions.ts`, всегда `redirect('/')`),
 * поэтому уже вошедший пользователь позже находит этот путь заново через
 * ссылку «Разместить рекламу» на `/businesses` (см. `BusinessesWidget`).
 */
export default async function AdvertisePage() {
  let isLoggedIn = false;
  try {
    isLoggedIn = Boolean(await getSessionUser());
  } catch {
    isLoggedIn = false;
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <span className={styles['logo-dot']} aria-hidden="true" />
        <h1 className={styles.title}>Реклама на Таверне</h1>
        <p className={styles.subtitle}>
          Самостоятельная рекламная платформа: настройте таргетинг, загрузите креатив и запустите
          показ на сайтах бизнесов Таверны — без менеджера и без собственного сайта.
        </p>

        <div className={styles.steps}>
          {STEPS.map((step, index) => (
            <div key={step.title} className={styles.step}>
              <span className={styles['step__index']}>{index + 1}</span>
              <div className={styles['step__body']}>
                <span className={styles['step__title']}>{step.title}</span>
                <span className={styles['step__description']}>{step.description}</span>
              </div>
            </div>
          ))}
        </div>

        <Link href={isLoggedIn ? '/advertise/new' : '/auth'} className={styles.cta}>
          {isLoggedIn ? 'Создать кабинет рекламодателя' : 'Войти и начать'}
        </Link>

        <p className={styles.existing}>
          Уже есть бизнес на Таверне? Управляйте рекламой во вкладке «Реклама» его дашборда —
          отдельный кабинет вам не нужен.
        </p>
      </div>
    </main>
  );
}

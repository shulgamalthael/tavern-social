'use client';

import Link from 'next/link';
import {
  BackIcon,
  CheckIcon,
  DesktopIcon,
  ExternalLinkIcon,
  EyeIcon,
  GlobeIcon,
  MobileIcon,
  RedoIcon,
  TabletIcon,
  UndoIcon,
} from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';
import { useWebsiteBuilderStore, type Viewport } from '@/entities/website';
import { Loader } from '@/shared/ui/Loader';
import styles from './BuilderToolbar.module.scss';

const VIEWPORTS: { id: Viewport; icon: typeof DesktopIcon; label: string }[] = [
  { id: 'desktop', icon: DesktopIcon, label: 'Десктоп' },
  { id: 'tablet', icon: TabletIcon, label: 'Планшет' },
  { id: 'mobile', icon: MobileIcon, label: 'Телефон' },
];

export interface BuilderToolbarProps {
  businessId: string;
  businessName: string;
  onPreview: () => void;
  onPublish: () => void;
  isPublishing: boolean;
}

export function BuilderToolbar({
  businessId,
  businessName,
  onPreview,
  onPublish,
  isPublishing,
}: BuilderToolbarProps) {
  const viewport = useWebsiteBuilderStore((state) => state.viewport);
  const setViewport = useWebsiteBuilderStore((state) => state.setViewport);
  const history = useWebsiteBuilderStore((state) => state.history);
  const future = useWebsiteBuilderStore((state) => state.future);
  const undo = useWebsiteBuilderStore((state) => state.undo);
  const redo = useWebsiteBuilderStore((state) => state.redo);
  const saveStatus = useWebsiteBuilderStore((state) => state.saveStatus);
  const isDirty = useWebsiteBuilderStore((state) => state.isDirty);

  return (
    <header className={styles.toolbar}>
      <div className={styles['toolbar__group']}>
        <Link
          href={`/business/${businessId}`}
          className={styles['toolbar__back']}
          aria-label="Назад к бизнесу"
        >
          <BackIcon />
        </Link>
        <span className={styles['toolbar__name']}>{businessName}</span>
      </div>

      <div className={styles['toolbar__group']}>
        <button
          type="button"
          className={styles['toolbar__icon-button']}
          aria-label="Отменить"
          disabled={history.length === 0}
          onClick={undo}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className={styles['toolbar__icon-button']}
          aria-label="Повторить"
          disabled={future.length === 0}
          onClick={redo}
        >
          <RedoIcon />
        </button>
      </div>

      <div
        className={cn(styles['toolbar__group'], styles['toolbar__viewports'])}
        role="group"
        aria-label="Просмотр"
      >
        {VIEWPORTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              styles['toolbar__viewport-button'],
              viewport === item.id && styles['toolbar__viewport-button--active'],
            )}
            aria-label={item.label}
            aria-pressed={viewport === item.id}
            title={item.label}
            onClick={() => setViewport(item.id)}
          >
            <item.icon />
          </button>
        ))}
      </div>

      <div className={styles['toolbar__group']}>
        <span className={styles['toolbar__save-status']}>
          {saveStatus === 'loading' && <Loader label="Сохраняем…" />}
          {saveStatus !== 'loading' && !isDirty && saveStatus === 'success' && (
            <>
              <CheckIcon /> Сохранено
            </>
          )}
          {saveStatus === 'error' && 'Не удалось сохранить'}
        </span>

        <button
          type="button"
          className={styles['toolbar__ghost-button']}
          aria-label="Предпросмотр"
          onClick={onPreview}
        >
          <EyeIcon />
          <span>Предпросмотр</span>
        </button>

        <button
          type="button"
          className={styles['toolbar__publish-button']}
          aria-label="Опубликовать"
          onClick={onPublish}
          disabled={isPublishing}
        >
          {isPublishing ? <Loader label="Публикуем…" /> : <GlobeIcon />}
          {!isPublishing && <span>Опубликовать</span>}
        </button>

        <Link
          href={`/business/${businessId}`}
          className={cn(styles['toolbar__icon-button'], styles['toolbar__external-link'])}
          aria-label="Открыть страницу бизнеса"
          target="_blank"
        >
          <ExternalLinkIcon />
        </Link>
      </div>
    </header>
  );
}

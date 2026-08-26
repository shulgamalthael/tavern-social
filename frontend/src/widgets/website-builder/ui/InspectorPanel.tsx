'use client';

import { useState } from 'react';
import { findBlock, useWebsiteBuilderStore } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { BackIcon } from '@/shared/ui/icons';
import { BlockInspectorForm } from '../inspector/BlockInspectorForm';
import { ThemePanel } from '../inspector/ThemePanel';
import styles from './InspectorPanel.module.scss';

type InspectorTab = 'block' | 'theme';

export interface InspectorPanelProps {
  businessId: string;
  className?: string;
  /** Кнопка «Назад» перед вкладками — видна только на телефоне/планшете
   * (см. `.back` в `InspectorPanel.module.scss`), где инспектор занимает
   * весь экран как отдельная вкладка билдера (см. `WebsiteBuilderWidget.
   * tsx`, `activePane`), а не постоянная колонка — нужен явный способ
   * вернуться к холсту, а не просто щёлкнуть по нему (он не виден рядом). */
  onBack?: () => void;
}

/**
 * Правая панель билдера — либо форма выбранного блока (`BlockInspectorForm`),
 * либо глобальная тема сайта (`ThemePanel`), переключаются вкладками сверху.
 * Выбор блока на канвасе (`CanvasBlock.tsx`, клик) автоматически переключает
 * сюда на вкладку «Блок» — не нужно щёлкать вкладку вручную после каждого
 * клика по новому блоку.
 */
export function InspectorPanel({ businessId, className, onBack }: InspectorPanelProps) {
  const document = useWebsiteBuilderStore((state) => state.document);
  const activePageId = useWebsiteBuilderStore((state) => state.activePageId);
  const selectedBlockId = useWebsiteBuilderStore((state) => state.selectedBlockId);

  const [tab, setTab] = useState<InspectorTab>('theme');

  // Переключение на вкладку «Блок» при выборе нового блока — не эффект
  // (второй проход рендера ради setState того не стоит), а корректировка
  // состояния прямо во время рендера, как рекомендует React для «сбросить
  // состояние, когда проп изменился» (см. react.dev, «You Might Not Need
  // an Effect» — паттерн с сравнением текущего/предыдущего значения).
  const [autoTabbedFor, setAutoTabbedFor] = useState<string | null>(null);
  if (selectedBlockId && selectedBlockId !== autoTabbedFor) {
    setAutoTabbedFor(selectedBlockId);
    setTab('block');
  }

  if (!document) return null;

  const page = document.pages.find((item) => item.id === activePageId);
  const selectedBlock = selectedBlockId && page ? findBlock(page.blocks, selectedBlockId) : null;

  return (
    <div className={cn(styles.panel, className)}>
      <div className={styles.tabs}>
        {onBack && (
          <button
            type="button"
            className={styles.back}
            aria-label="Назад к холсту"
            onClick={onBack}
          >
            <BackIcon />
          </button>
        )}
        <button
          type="button"
          className={cn(styles.tab, tab === 'block' && styles['tab--active'])}
          onClick={() => setTab('block')}
        >
          Блок
        </button>
        <button
          type="button"
          className={cn(styles.tab, tab === 'theme' && styles['tab--active'])}
          onClick={() => setTab('theme')}
        >
          Тема сайта
        </button>
      </div>

      <ScrollArea className={styles.content}>
        {tab === 'block' &&
          (selectedBlock ? (
            <BlockInspectorForm block={selectedBlock} businessId={businessId} />
          ) : (
            <EmptyState
              className={styles.empty}
              title="Блок не выбран"
              description="Кликните по любому блоку на холсте, чтобы настроить его содержимое и вид."
            />
          ))}

        {tab === 'theme' && <ThemePanel theme={document.theme} businessId={businessId} />}
      </ScrollArea>
    </div>
  );
}

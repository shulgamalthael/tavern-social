'use client';

import { useState } from 'react';
import { useWebsiteBuilderStore } from '@/entities/website';
import { cn } from '@/shared/lib/cn';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from '@/shared/ui/icons';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { PageSeoModal } from './PageSeoModal';
import styles from './PagesPanel.module.scss';

export interface PagesPanelProps {
  businessId: string;
  className?: string;
}

/**
 * Список страниц сайта — раньше билдер физически не умел показать больше
 * одной страницы: `activePageId` в сторе существовал, но ничего не давало
 * его сменить (см. ROADMAP.md, Phase 0 — «нет multi-page роутинга вообще»).
 * Первая страница по порядку — домашняя, открывается на публичном сайте без
 * сегмента пути (см. `WebsitePage` в backend `schema.prisma`), поэтому
 * реордер здесь — не косметика, а то, что решает, какая страница окажется
 * домашней.
 *
 * Переименование — инлайн `<input>`, не отдельная модалка: единственное
 * редактируемое поле здесь, модалка была бы лишним шагом ради одного текста.
 * Удаление подтверждается — необратимо теряет все блоки страницы, если
 * пользователь не успеет нажать Undo (см. `store.removePage`, участвует в
 * общей истории отмены наравне с правками блоков).
 *
 * SEO страницы (заголовок/описание/OG-картинка, см. ROADMAP.md §3.11/§8
 * Phase 10) — отдельная модалка (`PageSeoModal`), не инлайн-поле, в отличие
 * от переименования: три поля плюс картинка через `ImageField` не влезли бы
 * в строку списка так же естественно, как один текстовый `title`.
 */
export function PagesPanel({ businessId, className }: PagesPanelProps) {
  const document = useWebsiteBuilderStore((state) => state.document);
  const activePageId = useWebsiteBuilderStore((state) => state.activePageId);
  const setActivePage = useWebsiteBuilderStore((state) => state.setActivePage);
  const addPage = useWebsiteBuilderStore((state) => state.addPage);
  const renamePage = useWebsiteBuilderStore((state) => state.renamePage);
  const removePage = useWebsiteBuilderStore((state) => state.removePage);
  const movePage = useWebsiteBuilderStore((state) => state.movePage);
  const updatePageSeo = useWebsiteBuilderStore((state) => state.updatePageSeo);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [seoPageId, setSeoPageId] = useState<string | null>(null);

  if (!document) return null;
  const pages = document.pages;

  function startEditing(pageId: string, currentTitle: string) {
    setEditingId(pageId);
    setDraftTitle(currentTitle);
  }

  function commitEditing() {
    if (editingId && draftTitle.trim()) {
      renamePage(editingId, draftTitle.trim());
    }
    setEditingId(null);
  }

  return (
    <ScrollArea className={cn(styles.panel, className)} viewportClassName={styles.viewport}>
      <ul className={styles.list}>
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isHome = index === 0;
          const isEditing = editingId === page.id;

          return (
            <li
              key={page.id}
              className={cn(styles.row, isActive && styles['row--active'])}
              onClick={() => !isEditing && setActivePage(page.id)}
            >
              <span className={styles.row__order}>
                <button
                  type="button"
                  className={styles.row__moveButton}
                  aria-label="Переместить страницу выше"
                  disabled={index === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    movePage(page.id, 'up');
                  }}
                >
                  <ChevronUpIcon />
                </button>
                <button
                  type="button"
                  className={styles.row__moveButton}
                  aria-label="Переместить страницу ниже"
                  disabled={index === pages.length - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    movePage(page.id, 'down');
                  }}
                >
                  <ChevronDownIcon />
                </button>
              </span>

              <div className={styles.row__body}>
                {isEditing ? (
                  <input
                    autoFocus
                    className={styles.row__input}
                    value={draftTitle}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={commitEditing}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitEditing();
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <>
                    <span className={styles.row__title}>{page.title}</span>
                    <span className={styles.row__slug}>
                      {isHome ? 'Главная — открывается по адресу сайта' : `/${page.slug}`}
                    </span>
                  </>
                )}
              </div>

              {!isEditing && (
                <span className={styles.row__actions}>
                  <button
                    type="button"
                    className={styles.row__action}
                    aria-label="Переименовать страницу"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditing(page.id, page.title);
                    }}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.row__action}
                    aria-label="Настройки SEO страницы"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSeoPageId(page.id);
                    }}
                  >
                    <SettingsIcon />
                  </button>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      className={cn(styles.row__action, styles['row__action--danger'])}
                      aria-label="Удалить страницу"
                      onClick={(event) => {
                        event.stopPropagation();
                        setConfirmDeleteId(page.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className={styles.addButton} onClick={() => addPage('Новая страница')}>
        <PlusIcon />
        Добавить страницу
      </button>

      {confirmDeleteId && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDeleteId(null)}>
          <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.confirmCard__text}>
              Удалить страницу «{pages.find((page) => page.id === confirmDeleteId)?.title}» вместе
              со всем её содержимым? Это можно отменить сразу через «Отменить» в тулбаре, но не
              позже.
            </p>
            <div className={styles.confirmCard__actions}>
              <button
                type="button"
                className={styles.confirmCard__cancel}
                onClick={() => setConfirmDeleteId(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmCard__delete}
                onClick={() => {
                  removePage(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {seoPageId &&
        (() => {
          const seoPage = pages.find((page) => page.id === seoPageId);
          if (!seoPage) return null;
          return (
            <PageSeoModal
              page={seoPage}
              businessId={businessId}
              onSave={(patch) => updatePageSeo(seoPage.id, patch)}
              onClose={() => setSeoPageId(null)}
            />
          );
        })()}
    </ScrollArea>
  );
}

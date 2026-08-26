'use client';

import { useEffect, useRef } from 'react';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { saveWebsiteDraft } from '../api/save-website-draft';
import { useWebsiteBuilderStore } from './website-store';

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * Debounce-автосохранение поверх стора билдера — 1.5с без новых изменений,
 * затем PATCH черновика (см. `entities/website/api/save-website-draft.ts`).
 * `savingRef` не даёт запустить второй запрос, пока первый ещё летит —
 * узкое окно «пользователь продолжил печатать ровно во время сохранения»
 * не теряет данные: следующее естественное срабатывание debounce (как
 * только пользователь снова сделает паузу) досохранит уже актуальную
 * версию документа, тот же принцип, что и у большинства автосохранений.
 * Возвращает `saveNow` — ручной путь для кнопки «Сохранить» в тулбаре
 * (см. `widgets/website-builder/ui/BuilderToolbar.tsx`), без ожидания
 * debounce.
 */
export function useAutosave(): { saveNow: () => Promise<void> } {
  const businessId = useWebsiteBuilderStore((state) => state.businessId);
  const document = useWebsiteBuilderStore((state) => state.document);
  const isDirty = useWebsiteBuilderStore((state) => state.isDirty);
  const setSaveStatus = useWebsiteBuilderStore((state) => state.setSaveStatus);
  const markSaved = useWebsiteBuilderStore((state) => state.markSaved);

  const debouncedDocument = useDebouncedValue(document, AUTOSAVE_DEBOUNCE_MS);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!businessId || !debouncedDocument || !isDirty || savingRef.current) return;

    savingRef.current = true;
    setSaveStatus('loading');
    saveWebsiteDraft(businessId, debouncedDocument)
      .then((result) => markSaved(result.updatedAt, debouncedDocument))
      .catch(() => setSaveStatus('error'))
      .finally(() => {
        savingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сохраняем именно debounced-снимок, не каждое промежуточное изменение
  }, [debouncedDocument, businessId]);

  const saveNow = async () => {
    const state = useWebsiteBuilderStore.getState();
    if (!state.businessId || !state.document || savingRef.current) return;

    const snapshot = state.document;
    savingRef.current = true;
    setSaveStatus('loading');
    try {
      const result = await saveWebsiteDraft(state.businessId, snapshot);
      markSaved(result.updatedAt, snapshot);
    } catch {
      setSaveStatus('error');
    } finally {
      savingRef.current = false;
    }
  };

  // Debounce — 1.5с БЕЗ новых изменений — оставляет ровно такое же окно, где
  // несохранённая правка существует только в памяти вкладки: закрыть вкладку,
  // обновить страницу или уйти по внешней ссылке в этот момент значило бы
  // молча потерять её без единого предупреждения (подтверждено вручную —
  // именно так и произошло при проверке этой самой фичи: страница, добавленная
  // через `PagesPanel`, пропадала, если уйти со страницы раньше, чем сработает
  // debounce). `beforeunload` не помогает при обычной навигации ссылкой внутри
  // приложения (SPA-переход не выгружает страницу) — та часть риска закрыта
  // отдельно, в `WebsiteBuilderWidget.tsx` (см. её эффект размонтирования,
  // досохраняющий черновик перед сбросом стора).
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (useWebsiteBuilderStore.getState().isDirty) {
        event.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return { saveNow };
}

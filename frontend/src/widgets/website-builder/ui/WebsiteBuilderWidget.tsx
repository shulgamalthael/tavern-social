'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBusiness, type Business } from '@/entities/business';
import {
  getWebsiteDraft,
  publishWebsite,
  STARTER_TEMPLATES,
  useAutosave,
  useWebsiteBuilderStore,
  type BlockBusinessContext,
  type Viewport,
} from '@/entities/website';
import { AiAssistantPanel } from '@/features/ai-chat';
import { cn } from '@/shared/lib/cn';
import { useAsyncData } from '@/shared/lib/use-async-data';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Loader } from '@/shared/ui/Loader';
import {
  ChevronDownIcon,
  CloseIcon,
  FileIcon,
  GridIcon,
  SettingsIcon,
  SparkleIcon,
} from '@/shared/ui/icons';
import { applyStarterTemplate } from '../lib/apply-starter-template';
import { AddBlockModal } from './AddBlockModal';
import { BuilderDndProvider } from './BuilderDndProvider';
import { BuilderToolbar } from './BuilderToolbar';
import { Canvas } from './Canvas';
import { ComponentLibraryPanel } from './ComponentLibraryPanel';
import { InspectorPanel } from './InspectorPanel';
import { PagesPanel } from './PagesPanel';
import { PreviewModal } from './PreviewModal';
import { StarterTemplatePicker } from './StarterTemplatePicker';
import styles from './WebsiteBuilderWidget.module.scss';

const CANVAS_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '834px',
  mobile: '390px',
};

/**
 * Холст всегда смонтирован и всегда виден (см. JSX ниже) — не пересоздаётся
 * при переключении панелей, чтобы не терять его скролл/DnD-состояние, и
 * никогда не прячется на весь экран чужой панелью: пользователь должен
 * видеть результат правки вживую, а не только после закрытия панели (см.
 * корневой план задачи — «в реальном времени видны изменения на сайте»,
 * этим требованием раньше жертвовал полноэкранный режим на телефоне/
 * планшете). Библиотека и инспектор — раскладная панель ограниченной высоты
 * поверх холста (не постоянная колонка сбоку и не отдельный полноэкранный
 * режим), рендерятся условно, только когда активны — они не хранят ничего,
 * кроме отражения общего стора, пересоздание им ничего не стоит.
 *
 * Переключатель один и тот же по смыслу на всех экранах (`PANEL_BAR_TABS`,
 * два пункта — «Холста» как отдельной вкладки не нужно, раз он всегда на
 * виду) — просто в двух местах верстки: сверху вторым хедером на десктопе
 * (курсор дотягивается куда угодно) и снизу отдельной панелью вкладок на
 * телефоне/планшете (там снизу — где действительно удобно дотянуться
 * пальцем, тот же принцип, что у `widgets/navigation-dock`). Повторный клик
 * по уже открытой вкладке в обоих местах сворачивает панель обратно.
 */
type BuilderPane = 'canvas' | 'library' | 'inspector' | 'pages';

const PANEL_BAR_TABS: {
  id: 'pages' | 'library' | 'inspector';
  icon: typeof GridIcon;
  label: string;
}[] = [
  { id: 'pages', icon: FileIcon, label: 'Страницы' },
  { id: 'library', icon: GridIcon, label: 'Блоки' },
  { id: 'inspector', icon: SettingsIcon, label: 'Настройки' },
];

export interface WebsiteBuilderWidgetProps {
  businessId: string;
}

function toBusinessContext(business: Business): BlockBusinessContext {
  return {
    businessId: business.id,
    name: business.name,
    logoUrl: business.logoUrl,
    email: business.email,
    phone: business.phone,
    address: business.address,
    socialLinks: business.socialLinks,
  };
}

/**
 * Точка входа в конструктор сайта — фиксирует бизнеса, чей документ должен
 * быть открыт (`businessId`), подгружает его вместе с профилем бизнеса и
 * заполняет ими `useWebsiteBuilderStore` (см. `entities/website/model/
 * website-store.ts`, `loadDocument` — единственная функция, которая
 * ПОЛНОСТЬЮ перезаписывает документ/историю/выбор, поэтому открытие
 * билдера другого бизнеса никогда не показывает данные предыдущего).
 * Дальше — три панели (библиотека/канвас/инспектор) поверх одного и того
 * же стора, автосохранение (`useAutosave`) и предпросмотр/публикация,
 * использующие тот же документ, что уже лежит в сторе.
 */
export function WebsiteBuilderWidget({ businessId }: WebsiteBuilderWidgetProps) {
  const fetcher = useCallback(
    () =>
      Promise.all([getBusiness(businessId), getWebsiteDraft(businessId)]).then(
        ([business, draft]) => ({ business, draft }),
      ),
    [businessId],
  );
  const { status, data, error, refetch } = useAsyncData(fetcher);

  const document = useWebsiteBuilderStore((state) => state.document);
  const loadedBusinessId = useWebsiteBuilderStore((state) => state.businessId);
  const loadDocument = useWebsiteBuilderStore((state) => state.loadDocument);
  const applyTemplate = useWebsiteBuilderStore((state) => state.applyTemplate);
  const resetStore = useWebsiteBuilderStore((state) => state.reset);
  const viewport = useWebsiteBuilderStore((state) => state.viewport);
  const activePageId = useWebsiteBuilderStore((state) => state.activePageId);
  const selectedBlockId = useWebsiteBuilderStore((state) => state.selectedBlockId);

  const { saveNow } = useAutosave();

  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isPublishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [templateDismissed, setTemplateDismissed] = useState(false);
  const [activePane, setActivePane] = useState<BuilderPane>('canvas');
  const [isAiChatOpen, setAiChatOpen] = useState(false);
  const aiBubbleRef = useRef<HTMLButtonElement | null>(null);
  const aiWindowRef = useRef<HTMLDivElement | null>(null);

  // `?template=<id>` в URL — AI-4 онбординг (`create_business`, см.
  // AI_PLATFORM_ROADMAP.md §11) редиректит сюда сразу с выбранным моделью
  // шаблоном, чтобы новый бизнес не встречал ту же пустую страницу и ручной
  // `StarterTemplatePicker` ниже, которую уже видел бы, если бы создавал
  // бизнес вручную. Читаем через `window.location`, не `useSearchParams()` —
  // этот компонент рендерит реальный контент только после клиентской
  // загрузки данных (`status` стартует `'loading'` и на сервере, и на
  // клиенте, см. `useAsyncData.ts`), так что SSR/гидратация этот код вообще
  // не задевают, а `useSearchParams()`'s требование Suspense-границы —
  // сложность без пользы для чисто клиентского значения. `useState` с
  // ленивым инициализатором — читаем один раз при монтировании, не при
  // каждом рендере.
  const [pendingAiTemplateId] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('template'),
  );
  const [isApplyingAiTemplate, setApplyingAiTemplate] = useState(Boolean(pendingAiTemplateId));
  const aiTemplateHandledRef = useRef(false);

  // Выбор блока переключает на вкладку «Настройки» — без эффекта, той же
  // логикой сравнения предыдущего значения прямо во время рендера, что и
  // автопереключение вкладки в `InspectorPanel.tsx` (см. её комментарий про
  // `react-hooks/set-state-in-effect`). Теперь это раскрывает панель
  // «Настройки» и на десктопе (см. `.panelBar` — раскладная панель, не
  // постоянная колонка), не только на телефоне/планшете — выбрал блок на
  // холсте, сразу увидел его настройки, без лишнего клика по вкладке.
  const [autoPanedFor, setAutoPanedFor] = useState<string | null>(null);
  if (selectedBlockId && selectedBlockId !== autoPanedFor) {
    setAutoPanedFor(selectedBlockId);
    setActivePane('inspector');
  }

  useEffect(() => {
    if (data && loadedBusinessId !== businessId) {
      loadDocument(businessId, data.draft.document);
    }
  }, [data, businessId, loadedBusinessId, loadDocument]);

  // Применяет `pendingAiTemplateId` ровно один раз, как только документ этого
  // бизнеса реально загружен в стор (`loadedBusinessId === businessId`) —
  // раньше `document`/`data.business` ещё не гарантированно те, что нужны.
  // `aiTemplateHandledRef` — защита от повторного применения при любых
  // последующих ре-рендерах эффекта (не `useState`, потому что сам факт
  // «уже обработали» не должен вызывать перерендер). Неизвестный/пустой
  // `templateId` (модель прислала `blank`, или `STARTER_TEMPLATES` не
  // содержит такой id) — молча ничего не делает и просто снимает индикатор
  // загрузки, попадая в обычный `StarterTemplatePicker` ниже, тот же честный
  // fallback, что и у ручного создания.
  useEffect(() => {
    if (aiTemplateHandledRef.current) return;
    if (!pendingAiTemplateId || !data || !document || loadedBusinessId !== businessId) return;

    aiTemplateHandledRef.current = true;
    const page = document.pages.find((item) => item.id === activePageId) ?? document.pages[0];
    const template = STARTER_TEMPLATES.find((item) => item.id === pendingAiTemplateId);

    window.history.replaceState(null, '', window.location.pathname);

    // Оба исхода (шаблон найден/не найден) идут через один и тот же async-
    // колбэк, а не сразу вызывают `setApplyingAiTemplate` синхронно в теле
    // эффекта — `react-hooks/set-state-in-effect` (эффект должен
    // синхронизировать с внешней системой, а не диспатчить state напрямую;
    // `await`, пусть даже без реальной задержки в ветке "не найден", уже
    // выносит вызов за пределы синхронного тела эффекта).
    void (async () => {
      if (!template || !page || page.blocks.length > 0) {
        setApplyingAiTemplate(false);
        return;
      }

      const { blocks, seeded } = await applyStarterTemplate(
        businessId,
        data.business.name,
        template,
        data.business.capabilities,
      );
      applyTemplate(blocks);
      if (seeded) refetch();
      setApplyingAiTemplate(false);
    })();
  }, [
    pendingAiTemplateId,
    data,
    document,
    loadedBusinessId,
    businessId,
    activePageId,
    applyTemplate,
    refetch,
  ]);

  useEffect(() => {
    return () => {
      // Уход со страницы билдера ссылкой ВНУТРИ приложения (например, кнопка
      // «Назад» в тулбаре) — обычный SPA-переход, он не выгружает страницу и
      // поэтому не ловится `beforeunload` (см. `useAutosave.ts`, тот
      // предупреждает только про закрытие вкладки/обновление/внешнюю
      // ссылку). Если размонтирование застало несохранённую правку в
      // debounce-окне автосохранения (полтора секунды без новых изменений,
      // см. `useAutosave.ts`), она бы молча пропала вместе со стором ниже —
      // подтверждено вручную при проверке страниц билдера. `saveNow` сам
      // читает актуальный документ через `getState()` в момент вызова, не
      // замыкает устаревший снимок из рендера, где был создан этот колбэк.
      if (useWebsiteBuilderStore.getState().isDirty) void saveNow();
      resetStore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс/досохранение только при размонтировании самого виджета, `resetStore`/`saveNow` — не обязаны быть в зависимостях по той же причине, что описана в комментарии выше
  }, []);

  // Тот же UX, что и у любого другого плавающего попапа этого приложения
  // (дропдауны шапки, `NotificationsDropdown`/`SearchDropdown`) — Escape и
  // клик вне окна закрывают его. Слушатели вешаются ТОЛЬКО пока чат открыт
  // (эффект перезапускается по `isAiChatOpen`), не постоянно на весь экран.
  // `globalThis.document`, НЕ голый `document` — в этом компоненте уже есть
  // локальная переменная `document` (стор, JSON-документ сайта, см. выше),
  // она затеняет глобальный DOM `document` в области видимости всей функции
  // компонента; голый `document.addEventListener` здесь попал бы на объект
  // документа сайта (падение в рантайме — `document.addEventListener` не
  // существует у `WebsiteDocument`), не на DOM. Ровно это поймал линт
  // (`react-hooks/exhaustive-deps` пожаловался на «отсутствующую
  // зависимость `document`» — он думал, что это стор, а не DOM).
  useEffect(() => {
    if (!isAiChatOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (aiWindowRef.current?.contains(target)) return;
      if (aiBubbleRef.current?.contains(target)) return;
      setAiChatOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAiChatOpen(false);
    }

    globalThis.document.addEventListener('mousedown', handlePointerDown);
    globalThis.document.addEventListener('keydown', handleKeyDown);
    return () => {
      globalThis.document.removeEventListener('mousedown', handlePointerDown);
      globalThis.document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAiChatOpen]);

  // AI-инструменты (`AiChatPanel`) пишут прямо в backend через
  // `WebsitesService.saveDraft`, минуя стор билдера — стор после этого не
  // знает о новых блоках/страницах, пока кто-то заново не подгрузит
  // документ. Перечитываем и кладём в стор ТОЛЬКО если в конструкторе нет
  // несохранённых локальных правок (`isDirty`) — иначе либо затираем
  // правки пользователя свежим документом с сервера, либо (если бы вместо
  // этого сохраняли стор поверх) откатываем то, что только что сделал AI.
  // `getState()`, не замыкание из рендера — тот же приём, что и у
  // `saveNow` в cleanup-эффекте ниже, актуальное значение на момент вызова.
  // Вызывается панелью ПОСЛЕ КАЖДОГО мутирующего инструмента в ходе (AI-3,
  // "live-canvas apply-on-tool-result", см. `AiChatPanelProps.onMutationApplied`),
  // может быть вызвана несколько раз за один ход — сам обработчик ничего не
  // помнит между вызовами (просто перечитывает актуальный документ), так что
  // повторные вызовы идемпотентны и не нуждаются в собственной дедупликации.
  const handleAiMutation = useCallback(async (): Promise<boolean> => {
    if (useWebsiteBuilderStore.getState().isDirty) return false;
    const draft = await getWebsiteDraft(businessId);
    loadDocument(businessId, draft.document);
    return true;
  }, [businessId, loadDocument]);

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await saveNow();
      await publishWebsite(businessId);
    } catch {
      setPublishError('Не удалось опубликовать сайт — попробуйте ещё раз');
    } finally {
      setPublishing(false);
    }
  }

  if (
    status === 'loading' ||
    (status === 'success' && (!document || loadedBusinessId !== businessId))
  ) {
    return (
      <div className={styles.status}>
        <Loader label="Загружаем конструктор…" />
      </div>
    );
  }

  if (status === 'error' || !data) {
    return (
      <div className={styles.status}>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const businessContext = toBusinessContext(data.business);
  const page = document!.pages.find((item) => item.id === activePageId) ?? document!.pages[0];
  const isEmpty = page.blocks.length === 0;

  return (
    <div className={styles.root}>
      <BuilderToolbar
        businessId={businessId}
        businessName={data.business.name}
        onPreview={() => setPreviewOpen(true)}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />

      {publishError && (
        <div className={styles.banner} role="alert">
          {publishError}
        </div>
      )}

      {isEmpty && isApplyingAiTemplate ? (
        <div className={styles.status}>
          <Loader label="Настраиваем стартовый сайт…" />
        </div>
      ) : isEmpty && !templateDismissed ? (
        <StarterTemplatePicker
          businessId={businessId}
          businessName={data.business.name}
          existingCapabilities={data.business.capabilities}
          onDismiss={() => setTemplateDismissed(true)}
          onSeeded={refetch}
        />
      ) : (
        <>
          {/* Второй хедер — desktop (см. `.panelBar` в module.scss, на
           * телефоне/планшете скрыт — там та же роль у `.panelBarBottom`
           * ниже холста). Повторный клик по уже открытой вкладке сворачивает
           * панель обратно (`activePane` возвращается к `'canvas'`). */}
          <nav className={styles.panelBar} aria-label="Панели конструктора">
            {PANEL_BAR_TABS.map((tab) => {
              const isOpen = activePane === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(styles.panelBarTab, isOpen && styles['panelBarTab--active'])}
                  aria-expanded={isOpen}
                  onClick={() => setActivePane(isOpen ? 'canvas' : tab.id)}
                >
                  <tab.icon />
                  {tab.label}
                  <ChevronDownIcon
                    className={cn(
                      styles.panelBarChevron,
                      isOpen && styles['panelBarChevron--open'],
                    )}
                  />
                </button>
              );
            })}
          </nav>

          <BuilderDndProvider page={page}>
            <div className={styles.body}>
              {activePane === 'pages' && (
                <PagesPanel businessId={businessId} className={styles.panel} />
              )}
              {activePane === 'library' && (
                <ComponentLibraryPanel
                  className={styles.panel}
                  capabilities={data.business.capabilities}
                />
              )}
              {activePane === 'inspector' && (
                <InspectorPanel
                  businessId={businessId}
                  className={styles.panel}
                  onBack={() => setActivePane('canvas')}
                />
              )}

              <div className={styles.canvasArea}>
                <Canvas
                  page={page}
                  pages={document!.pages}
                  theme={document!.theme}
                  business={businessContext}
                  viewportWidth={CANVAS_WIDTH[viewport]}
                />
              </div>
            </div>
          </BuilderDndProvider>

          {/* Тот же переключатель, что и `.panelBar` выше, но снизу и только
           * на телефоне/планшете (см. module.scss) — там до верхнего хедера
           * пальцем тянуться неудобно, а до низа экрана — привычно (тот же
           * принцип, что у `widgets/navigation-dock`). */}
          <nav className={styles.panelBarBottom} aria-label="Панели конструктора">
            {PANEL_BAR_TABS.map((tab) => {
              const isOpen = activePane === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(styles.bottomTab, isOpen && styles['bottomTab--active'])}
                  aria-expanded={isOpen}
                  onClick={() => setActivePane(isOpen ? 'canvas' : tab.id)}
                >
                  <tab.icon />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </>
      )}

      {isPreviewOpen && (
        <PreviewModal
          page={page}
          pages={document!.pages}
          theme={document!.theme}
          business={businessContext}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <AddBlockModal capabilities={data.business.capabilities} />

      {/* Плавающее мини-окно AI, не вкладка панели — холст должен оставаться
       * полностью видимым, пока идёт диалог с AI (тот же принцип «холст
       * всегда на виду», что и у остальной части билдера, см. комментарий
       * компонента выше), а не делить экран с ним, как «Страницы»/«Блоки»/
       * «Настройки». `.aiWindow` рендерится ВСЕГДА (не условно) — скрывается
       * через `.aiWindow--hidden` (CSS `display: none`), а не размонтированием:
       * `AiAssistantPanel` внутри (вкладка «Чат») держит историю диалога в
       * собственном `useState`, закрытие/открытие пузыря не должно её терять
       * (см. её комментарий) — вторая вкладка, «История» (AI-3, activity
       * timeline), своего состояния не хранит, читает `AuditLog` заново при
       * каждом переключении на неё. */}
      <button
        ref={aiBubbleRef}
        type="button"
        className={styles.aiBubble}
        onClick={() => setAiChatOpen((open) => !open)}
        aria-expanded={isAiChatOpen}
        aria-label={isAiChatOpen ? 'Закрыть AI-ассистента' : 'Открыть AI-ассистента'}
      >
        {isAiChatOpen ? <CloseIcon /> : <SparkleIcon />}
      </button>

      <div
        ref={aiWindowRef}
        className={cn(styles.aiWindow, !isAiChatOpen && styles['aiWindow--hidden'])}
        role="dialog"
        aria-label="AI-ассистент"
        aria-hidden={!isAiChatOpen}
      >
        <AiAssistantPanel
          businessId={businessId}
          className={styles.aiWindow__panel}
          isOpen={isAiChatOpen}
          onMutationApplied={handleAiMutation}
        />
      </div>
    </div>
  );
}

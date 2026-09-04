import { create } from 'zustand';
import {
  createBlockId,
  duplicateBlock as duplicateBlockInTree,
  findBlock,
  findParentId,
  insertBlock,
  moveBlock as moveBlockInTree,
  remapBlockIds,
  removeBlock as removeBlockInTree,
  updateBlock as updateBlockInTree,
} from './block-tree';
import { createBlockInstance } from './registry';
import type { AsyncStatus } from '@/shared/lib/async-status';
import { slugify } from '@/shared/lib/slugify';
import type {
  BlockStyle,
  Viewport,
  WebsiteBlock,
  WebsiteDocument,
  WebsitePage,
  WebsiteTheme,
} from './types';

const MAX_HISTORY = 50;

interface HistoryEntry {
  document: WebsiteDocument;
}

interface WebsiteBuilderState {
  /** Бизнес, чей документ сейчас загружен — единственный «замок» против
   * смешения данных разных бизнесов (см. AGENTS.md, раздел про Zustand:
   * «не допускайте глобального состояния, которое может случайно смешать
   * данные»). Стор один на всё приложение (обычный Zustand-синглтон), но
   * `loadDocument` ВСЕГДА полностью перезаписывает и документ, и историю,
   * и businessId — открыть билдер другого бизнеса означает заново вызвать
   * `loadDocument` с его id (см. `widgets/website-builder/ui/
   * WebsiteBuilderWidget.tsx`, эффект по параметру маршрута), а не
   * доредактировать чужой документ поверх старого состояния. */
  businessId: string | null;
  document: WebsiteDocument | null;
  activePageId: string | null;
  selectedBlockId: string | null;
  viewport: Viewport;
  history: HistoryEntry[];
  future: HistoryEntry[];
  saveStatus: AsyncStatus;
  isDirty: boolean;
  lastSavedAt: string | null;
  /** Куда вставить блок, выбранный в открытой сейчас `AddBlockModal` (см.
   * `widgets/website-builder/ui/AddBlockModal.tsx`) — `null`, когда модалка
   * закрыта. Отдельное поле стора, а не локальное состояние компонента:
   * кнопки «+» между блоками живут в разных местах дерева (`Canvas.tsx`,
   * `CanvasBlock.tsx`), а модалка на них всего одна, рендерится один раз в
   * `WebsiteBuilderWidget.tsx` — стор избавляет от прокидывания колбэка через
   * все промежуточные уровни ради одного этого действия.
   *
   * Два режима вставки: `sibling` — обычная вставка в существующий список
   * детей на позицию `index` (кнопки «+» сверху/снизу блока, пустая
   * страница/контейнер); `beside` — вставка СЛЕВА/СПРАВА от блока `anchorId`
   * (новые крестообразные зоны по бокам блока), которая не встаёт в тот же
   * список, а оборачивает анкор и новый блок в общий `columns` (см.
   * `insertBlockBeside` ниже) — блоки страницы стоят друг под другом, поэтому
   * «слева/справа» физически возможно только через колонки. */
  insertionTarget: InsertionTarget | null;
  /** Куда реально попадёт перетаскиваемый (из библиотеки или уже
   * существующий на холсте) блок, если отпустить его прямо сейчас — только
   * для блока, НАД которым сейчас идёт наведение при drag-and-drop
   * (`BuilderDndProvider.tsx`'s `onDragOver`); `null` вне драга и когда
   * навели на пустую drop-зону (та уже сама подсвечивается через свой
   * `useDroppable`'s `isOver`, см. `EmptyDropZone.tsx` — второй индикатор
   * там не нужен). `CanvasBlock.tsx` рисует по нему тонкую линию у своего
   * верхнего/нижнего края. Эфемерное состояние UI, не часть истории
   * отмены — как `selectedBlockId`/`viewport`. */
  dragOverTarget: { blockId: string; position: 'before' | 'after' } | null;
}

export type InsertionTarget =
  | { mode: 'sibling'; parentId: string | null; index: number }
  | { mode: 'beside'; anchorId: string; side: 'left' | 'right' };

interface WebsiteBuilderActions {
  loadDocument: (businessId: string, document: WebsiteDocument) => void;
  reset: () => void;
  selectBlock: (blockId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  addBlock: (type: string, parentId: string | null, index: number) => string;
  /** Открывает `AddBlockModal` с запомненной позицией вставки — кнопка «+»
   * между блоками (`InsertBlockButton.tsx`) вызывает это вместо того, чтобы
   * сама знать про модалку. */
  openInsertPicker: (parentId: string | null, index: number) => void;
  /** То же самое, но для боковых крестообразных зон (`InsertSideZone.tsx`) —
   * запоминает анкор и сторону вместо позиции в списке (см.
   * `insertBlockBeside`). */
  openInsertPickerBeside: (anchorId: string, side: 'left' | 'right') => void;
  closeInsertPicker: () => void;
  /** `BuilderDndProvider.tsx`'s `onDragOver`/`onDragEnd`/`onDragCancel` —
   * см. комментарий у `dragOverTarget` в `WebsiteBuilderStore`. */
  setDragOverTarget: (target: { blockId: string; position: 'before' | 'after' } | null) => void;
  /** Вставляет новый блок типа `type` СЛЕВА/СПРАВА от блока `anchorId` —
   * оборачивает анкор (со всем его поддеревом) и новый блок в общий
   * `columns` с двумя `column`-детьми, на место, которое раньше занимал сам
   * анкор в его родителе. Так работает для ЛЮБОГО блока, а не только для
   * тех, что уже внутри `columns` — обычные блоки страницы стоят друг под
   * другом, поэтому «поставить рядом» без обёртки в колонки физически
   * невозможно (см. корневой план задачи — пользователь явно выбрал
   * авто-обёртку, а не «работает только внутри уже существующих Колонок»). */
  insertBlockBeside: (anchorId: string, side: 'left' | 'right', type: string) => string;
  /** Вставляет ГОТОВЫЙ набор блоков (Custom Widget Engine, AI_PLATFORM_
   * ROADMAP.md §2.4/§16.2) подряд, начиная с позиции `index` внутри
   * `parentId` (или на верхнем уровне страницы, если `null`) — тот же
   * "sibling"-режим позиционирования, что `addBlock`, но для НЕСКОЛЬКИХ
   * блоков сразу вместо одного. Каждому блоку присваивается свежий id через
   * `remapBlockIds` — тот же саженный виджет, вставленный дважды, не должен
   * породить два блока с одинаковым id. Сознательно не поддерживает "boковую"
   * (`insertBlockBeside`) вставку с авто-обёртыванием в колонки — виджет,
   * это уже несколько блоков, а не один, и однозначного способа обернуть N
   * блоков напротив анкора в одну колонку без произвольного решения о
   * порядке нет; вызывающий код при side-вставке использует ту же sibling-
   * позицию (сразу после анкора в его родителе), см. `AddBlockModal.tsx`. */
  insertWidgetBlocks: (blocks: WebsiteBlock[], parentId: string | null, index: number) => string[];
  /** Подставляет блоки готового стартового шаблона (см. `templates/index.ts`,
   * `StarterTemplate.build`) на место текущей (пустой) страницы — только
   * для самого первого входа в билдер, пока на странице нет ни одного
   * блока (см. `widgets/website-builder/ui/StarterTemplatePicker.tsx`).
   * Отдельный экшен, а не прямой `setState` из виджета — тот же принцип,
   * что и у остальных правок дерева блоков (проходит через `withHistory`,
   * так что «С чистого листа» после шаблона доступно через undo). */
  applyTemplate: (blocks: WebsiteBlock[]) => void;
  removeBlock: (blockId: string) => void;
  duplicateBlock: (blockId: string) => void;
  moveBlock: (blockId: string, parentId: string | null, index: number) => void;
  updateBlockProps: (blockId: string, patch: Record<string, unknown>) => void;
  updateBlockStyle: (blockId: string, patch: BlockStyle) => void;
  toggleBlockVisibility: (blockId: string, viewport: Viewport) => void;
  updateTheme: (patch: Partial<WebsiteTheme>) => void;
  updateSettings: (patch: Partial<WebsiteDocument['settings']>) => void;
  undo: () => void;
  redo: () => void;
  setSaveStatus: (status: AsyncStatus) => void;
  /** `savedDocument` — тот самый снимок документа, который реально долетел
   * до сервера в этом запросе (см. `useAutosave`) — НЕ обязательно текущий
   * `state.document`, если пользователь успел сделать что-то ещё, пока
   * запрос летел. Без этого сравнения `isDirty: false` выставлялся бы
   * безусловно, из-за чего билдер на секунду-другую врал бы «Сохранено»,
   * пока самое свежее изменение ещё не отправлено — реальная гонка, а не
   * гипотетическая: debounce не блокирует новые правки во время запроса,
   * только не даёт запустить второй запрос параллельно. */
  markSaved: (savedAt: string, savedDocument: WebsiteDocument) => void;
  /** Первая страница по порядку — домашняя, открывается на публичном сайте
   * без сегмента пути (см. `WebsitePage` в backend `schema.prisma` — та же
   * позиционная логика на сервере при сборке `Website.published`), поэтому
   * управление списком страниц — это управление их порядком не меньше, чем
   * их количеством. Каждое действие проходит через тот же history-стек, что
   * и правки блоков (`withDocumentHistory`) — «случайно удалил страницу»
   * должно так же отменяться `undo`, как и «случайно удалил блок». */
  setActivePage: (pageId: string) => void;
  addPage: (title: string) => string;
  renamePage: (pageId: string, title: string) => void;
  removePage: (pageId: string) => void;
  movePage: (pageId: string, direction: 'up' | 'down') => void;
  /** SEO-переопределения страницы (см. `WebsitePage.seoTitle`/
   * `seoDescription`/`ogImage`) — редактируются отдельной панелью
   * (`widgets/website-builder/ui/PageSeoModal.tsx`), не инспектором блока,
   * поэтому отдельный экшен, а не переиспользование `updateBlock`. */
  updatePageSeo: (
    pageId: string,
    patch: Pick<WebsitePage, 'seoTitle' | 'seoDescription' | 'ogImage'>,
  ) => void;
}

export type WebsiteBuilderStore = WebsiteBuilderState & WebsiteBuilderActions;

const initialState: WebsiteBuilderState = {
  businessId: null,
  document: null,
  activePageId: null,
  selectedBlockId: null,
  viewport: 'desktop',
  history: [],
  future: [],
  saveStatus: 'idle',
  isDirty: false,
  lastSavedAt: null,
  insertionTarget: null,
  dragOverTarget: null,
};

/** Применяет `updater` к активной странице документа и кладёт предыдущее
 * состояние в историю undo — единая точка для ЛЮБОЙ правки дерева блоков
 * (добавление/удаление/перемещение/дублирование/правка `props`/`style`),
 * чтобы undo/redo работал одинаково для всех них без ручного дублирования
 * этой логики в каждом экшене. */
function withHistory(
  state: WebsiteBuilderState,
  updater: (blocks: WebsiteBlock[]) => WebsiteBlock[],
): Partial<WebsiteBuilderState> {
  if (!state.document || !state.activePageId) return {};
  const pageIndex = state.document.pages.findIndex((page) => page.id === state.activePageId);
  if (pageIndex === -1) return {};

  const page = state.document.pages[pageIndex];
  const nextBlocks = updater(page.blocks);
  if (nextBlocks === page.blocks) return {};

  const nextPages = state.document.pages.map((existing, index) =>
    index === pageIndex ? { ...existing, blocks: nextBlocks } : existing,
  );
  const nextDocument: WebsiteDocument = { ...state.document, pages: nextPages };

  return {
    document: nextDocument,
    history: [...state.history, { document: state.document }].slice(-MAX_HISTORY),
    future: [],
    isDirty: true,
  };
}

/** Та же роль, что `withHistory` выше, но для правок, меняющих сам список
 * страниц (`document.pages`), а не дерево блоков одной активной страницы —
 * общий history-стек (`history`/`future`) один и тот же для обоих видов
 * правок, поэтому `undo` одинаково отменяет и «удалил блок», и «удалил
 * страницу», в том порядке, в котором они реально произошли. */
function withDocumentHistory(
  state: WebsiteBuilderState,
  updater: (document: WebsiteDocument) => WebsiteDocument,
): Partial<WebsiteBuilderState> {
  if (!state.document) return {};
  const nextDocument = updater(state.document);
  if (nextDocument === state.document) return {};

  return {
    document: nextDocument,
    history: [...state.history, { document: state.document }].slice(-MAX_HISTORY),
    future: [],
    isDirty: true,
  };
}

/** Черновой slug новой страницы — уникальный СРЕДИ УЖЕ ЗАГРУЖЕННЫХ страниц
 * этого документа. Финальную уникальность (на случай гонки с другой
 * вкладкой/сессией) всё равно проверяет БД (`@@unique([websiteId, slug])` в
 * schema.prisma) — это только чтобы не отправить заведомо коллидирующий
 * slug при обычной работе в одной вкладке (например, две страницы подряд
 * с одинаковым заголовком «Контакты»). */
function resolveUniquePageSlug(title: string, existingSlugs: string[]): string {
  const base = slugify(title);
  if (!existingSlugs.includes(base)) return base;

  let attempt = 2;
  while (existingSlugs.includes(`${base}-${attempt}`)) attempt += 1;
  return `${base}-${attempt}`;
}

export const useWebsiteBuilderStore = create<WebsiteBuilderStore>()((set, get) => ({
  ...initialState,

  loadDocument: (businessId, document) =>
    set({
      ...initialState,
      businessId,
      document,
      activePageId: document.pages[0]?.id ?? null,
    }),

  reset: () => set({ ...initialState }),

  selectBlock: (blockId) => set({ selectedBlockId: blockId }),

  setViewport: (viewport) => set({ viewport }),

  openInsertPicker: (parentId, index) =>
    set({ insertionTarget: { mode: 'sibling', parentId, index } }),

  openInsertPickerBeside: (anchorId, side) =>
    set({ insertionTarget: { mode: 'beside', anchorId, side } }),

  closeInsertPicker: () => set({ insertionTarget: null }),

  setDragOverTarget: (target) => set({ dragOverTarget: target }),

  addBlock: (type, parentId, index) => {
    const id = createBlockId();
    const block = createBlockInstance(type, id);
    set((state) => ({
      ...withHistory(state, (blocks) => insertBlock(blocks, block, parentId, index)),
      selectedBlockId: id,
    }));
    return id;
  },

  insertBlockBeside: (anchorId, side, type) => {
    const newBlockId = createBlockId();
    set((state) => ({
      ...withHistory(state, (blocks) => {
        const anchor = findBlock(blocks, anchorId);
        const parentId = findParentId(blocks, anchorId);
        if (!anchor || parentId === undefined) return blocks;

        const siblings = parentId === null ? blocks : (findBlock(blocks, parentId)?.children ?? []);
        const anchorIndex = siblings.findIndex((item) => item.id === anchorId);
        if (anchorIndex === -1) return blocks;

        const anchorColumn: WebsiteBlock = {
          ...createBlockInstance('column', createBlockId()),
          children: [anchor],
        };
        const newBlock = createBlockInstance(type, newBlockId);
        const newColumn: WebsiteBlock = {
          ...createBlockInstance('column', createBlockId()),
          children: [newBlock],
        };
        const columnsWrapper: WebsiteBlock = {
          ...createBlockInstance('columns', createBlockId()),
          children: side === 'left' ? [newColumn, anchorColumn] : [anchorColumn, newColumn],
        };

        const { blocks: withoutAnchor } = removeBlockInTree(blocks, anchorId);
        return insertBlock(withoutAnchor, columnsWrapper, parentId, anchorIndex);
      }),
      selectedBlockId: newBlockId,
    }));
    return newBlockId;
  },

  insertWidgetBlocks: (blocks, parentId, index) => {
    const freshBlocks = blocks.map(remapBlockIds);
    set((state) => ({
      ...withHistory(state, (existing) => {
        let result = existing;
        for (const [offset, block] of freshBlocks.entries()) {
          result = insertBlock(result, block, parentId, index + offset);
        }
        return result;
      }),
      selectedBlockId: freshBlocks[0]?.id ?? state.selectedBlockId,
    }));
    return freshBlocks.map((block) => block.id);
  },

  applyTemplate: (blocks) => {
    set((state) => withHistory(state, () => blocks));
  },

  removeBlock: (blockId) => {
    set((state) => {
      const patch = withHistory(state, (blocks) => removeBlockInTree(blocks, blockId).blocks);
      // `withHistory` возвращает `{}` без `document`, если правка ничего не
      // изменила (например, документ/страница ещё не загружены) — тогда
      // выбор точно не мог протухнуть, нет смысла его проверять.
      if (!state.selectedBlockId || !patch.document) return patch;

      // Удаление предка убирает из дерева и все его дети — простое
      // сравнение `selectedBlockId === blockId` не ловит этот случай,
      // раз выбранным мог быть как раз ВЛОЖЕННЫЙ блок, а не тот, чью
      // кнопку удаления нажали (тулбар предка виден уже при наведении,
      // не только при его собственном выборе — см. `CanvasBlock.module.
      // scss`, `.block:hover > .block__toolbar`). Проверяем по итоговому
      // дереву активной страницы, а не по id удаляемого блока — так
      // ловится и прямое, и косвенное (через предка) исчезновение.
      const nextPageBlocks =
        patch.document?.pages.find((page) => page.id === state.activePageId)?.blocks ?? [];
      const selectionStillExists = Boolean(findBlock(nextPageBlocks, state.selectedBlockId));

      return { ...patch, selectedBlockId: selectionStillExists ? state.selectedBlockId : null };
    });
  },

  duplicateBlock: (blockId) => {
    set((state) => withHistory(state, (blocks) => duplicateBlockInTree(blocks, blockId)));
  },

  moveBlock: (blockId, parentId, index) => {
    set((state) =>
      withHistory(state, (blocks) => moveBlockInTree(blocks, blockId, parentId, index)),
    );
  },

  updateBlockProps: (blockId, patch) => {
    set((state) =>
      withHistory(state, (blocks) =>
        updateBlockInTree(blocks, blockId, (block) => ({
          ...block,
          props: { ...block.props, ...patch },
        })),
      ),
    );

    // `columns` — единственный тип блока, у которого число детей должно
    // отражать число колонок (см. `blocks/layout/index.tsx`, комментарий
    // про то, что `columns` сам по себе не хранит счётчик) — узкий частный
    // случай, а не общий механизм для всех блоков, поэтому обрабатывается
    // здесь отдельно, а не через `fields`/generic-обновление выше.
    if ('count' in patch) {
      const state = get();
      const block = state.document && findBlock(getActiveBlocks(state), blockId);
      if (block?.type === 'columns' && typeof patch.count === 'number') {
        syncColumnsChildren(blockId, patch.count);
      }
    }
  },

  updateBlockStyle: (blockId, patch) => {
    set((state) =>
      withHistory(state, (blocks) =>
        updateBlockInTree(blocks, blockId, (block) => ({
          ...block,
          style: { ...block.style, ...patch },
        })),
      ),
    );
  },

  toggleBlockVisibility: (blockId, viewport) => {
    set((state) =>
      withHistory(state, (blocks) =>
        updateBlockInTree(blocks, blockId, (block) => ({
          ...block,
          hidden: { ...block.hidden, [viewport]: !block.hidden?.[viewport] },
        })),
      ),
    );
  },

  updateTheme: (patch) => {
    set((state) => {
      if (!state.document) return {};
      return {
        document: { ...state.document, theme: { ...state.document.theme, ...patch } },
        isDirty: true,
      };
    });
  },

  updateSettings: (patch) => {
    set((state) => {
      if (!state.document) return {};
      return {
        document: { ...state.document, settings: { ...state.document.settings, ...patch } },
        isDirty: true,
      };
    });
  },

  undo: () => {
    set((state) => {
      const previous = state.history[state.history.length - 1];
      if (!previous || !state.document) return {};
      return {
        document: previous.document,
        history: state.history.slice(0, -1),
        future: [{ document: state.document }, ...state.future].slice(0, MAX_HISTORY),
        isDirty: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      const next = state.future[0];
      if (!next || !state.document) return {};
      return {
        document: next.document,
        history: [...state.history, { document: state.document }].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        isDirty: true,
      };
    });
  },

  setSaveStatus: (status) => set({ saveStatus: status }),

  markSaved: (savedAt, savedDocument) =>
    set((state) => ({
      saveStatus: 'success',
      lastSavedAt: savedAt,
      // Ссылочное сравнение — документ в сторе всегда заменяется целиком
      // новым объектом при любой правке (`withHistory`), поэтому `===`
      // надёжно значит «ничего не изменилось, пока запрос летел».
      isDirty: state.document === savedDocument ? false : state.isDirty,
    })),

  setActivePage: (pageId) => set({ activePageId: pageId, selectedBlockId: null }),

  addPage: (title) => {
    const id = createBlockId();
    set((state) => ({
      ...withDocumentHistory(state, (document) => {
        const slug = resolveUniquePageSlug(
          title,
          document.pages.map((page) => page.slug),
        );
        const newPage: WebsitePage = { id, slug, title, blocks: [] };
        return { ...document, pages: [...document.pages, newPage] };
      }),
      activePageId: id,
      selectedBlockId: null,
    }));
    return id;
  },

  renamePage: (pageId, title) => {
    set((state) =>
      withDocumentHistory(state, (document) => ({
        ...document,
        pages: document.pages.map((page) => {
          if (page.id !== pageId) return page;
          // Slug следует за заголовком, ПОКА пользователь ни разу не задал
          // его вручную — сейчас это всегда так (отдельного поля для ручного
          // редактирования slug ещё нет, см. `PagesPanel.tsx`), но проверка
          // «текущий slug совпадает с тем, что дал бы старый заголовок»
          // остаётся корректной и после того, как такое поле появится: раз
          // slug разошёлся с заголовком, значит его подправили вручную, и
          // это больше не переименование, а точка отсчёта для URL, трогать
          // которую при обычном переименовании не следует.
          const hadAutoSlug = page.slug === slugify(page.title);
          if (!hadAutoSlug) return { ...page, title };

          const otherSlugs = document.pages
            .filter((item) => item.id !== pageId)
            .map((item) => item.slug);
          return { ...page, title, slug: resolveUniquePageSlug(title, otherSlugs) };
        }),
      })),
    );
  },

  removePage: (pageId) => {
    set((state) => {
      // Сайт не может остаться совсем без страниц — тогда и билдеру, и
      // публичному сайту нечего было бы показывать. Последнюю страницу
      // можно переименовать/очистить от блоков, но не удалить.
      if (!state.document || state.document.pages.length <= 1) return {};

      const patch = withDocumentHistory(state, (document) => ({
        ...document,
        pages: document.pages.filter((page) => page.id !== pageId),
      }));
      if (!patch.document) return patch;

      const wasActive = state.activePageId === pageId;
      return {
        ...patch,
        activePageId: wasActive ? (patch.document.pages[0]?.id ?? null) : state.activePageId,
        selectedBlockId: wasActive ? null : state.selectedBlockId,
      };
    });
  },

  movePage: (pageId, direction) => {
    set((state) =>
      withDocumentHistory(state, (document) => {
        const index = document.pages.findIndex((page) => page.id === pageId);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (index === -1 || targetIndex < 0 || targetIndex >= document.pages.length) {
          return document;
        }

        const pages = [...document.pages];
        [pages[index], pages[targetIndex]] = [pages[targetIndex], pages[index]];
        return { ...document, pages };
      }),
    );
  },

  updatePageSeo: (pageId, patch) => {
    set((state) =>
      withDocumentHistory(state, (document) => ({
        ...document,
        pages: document.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
      })),
    );
  },
}));

function getActiveBlocks(state: WebsiteBuilderState): WebsiteBlock[] {
  const page = state.document?.pages.find((item) => item.id === state.activePageId);
  return page?.blocks ?? [];
}

/** См. комментарий в `updateBlockProps` выше — держит число `column`-детей
 * блока `columns` в соответствии с полем `count` в его `props`, добавляя
 * пустые колонки или убирая последние (без потери контента в оставшихся). */
function syncColumnsChildren(columnsBlockId: string, targetCount: number): void {
  useWebsiteBuilderStore.setState((current) =>
    withHistory(current, (blocks) =>
      updateBlockInTree(blocks, columnsBlockId, (block) => {
        const children = block.children ?? [];
        if (children.length === targetCount) return block;
        if (children.length < targetCount) {
          const additions = Array.from({ length: targetCount - children.length }, () =>
            createBlockInstance('column', createBlockId()),
          );
          return { ...block, children: [...children, ...additions] };
        }
        return { ...block, children: children.slice(0, targetCount) };
      }),
    ),
  );
}

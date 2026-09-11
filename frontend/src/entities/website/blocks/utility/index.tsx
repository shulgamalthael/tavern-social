'use client';

import { cn } from '@/shared/lib/cn';
import { ChevronDownIcon, ChevronUpIcon, CodeIcon } from '@/shared/ui/icons';
import { useScrollPosition } from '../../lib/use-scroll-position';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget } from '../../model/types';
import styles from './utility.module.scss';

// --- Embed -----------------------------------------------------------------
// Только URL для `<iframe>`, не произвольный вставленный HTML — вставка
// сырого HTML с backend без санитизации была бы хранимой XSS-дырой на
// публичной странице (см. корневой план фичи, раздел про безопасность
// упрощений). Ссылка на iframe того же типа риска не несёт — это ровно то,
// что уже безопасно поддерживают `video`/`location`-блоки.

interface EmbedProps {
  embedUrl: string;
  height: number;
  caption: string;
}

function EmbedRenderer({ props }: BlockRendererProps<EmbedProps>) {
  if (!props.embedUrl) {
    return (
      <div className={styles.placeholder}>
        <CodeIcon />
        <span>Вставьте ссылку для встраивания виджета</span>
      </div>
    );
  }

  return (
    <figure className={styles.embed}>
      <iframe
        src={props.embedUrl}
        title={props.caption || 'Встроенный контент'}
        style={{ height: props.height }}
      />
      {props.caption && (
        <figcaption className={styles['embed__caption']}>{props.caption}</figcaption>
      )}
    </figure>
  );
}

const embedFields: FieldSchema[] = [
  {
    key: 'embedUrl',
    label: 'Ссылка для встраивания',
    control: 'url',
    hint: 'Calendly, форма, виджет бронирования и т. п.',
  },
  { key: 'height', label: 'Высота (px)', control: 'number', min: 200, max: 1200, step: 20 },
  { key: 'caption', label: 'Подпись', control: 'text' },
];

registerBlock<EmbedProps>({
  type: 'embed',
  label: 'Встраиваемый виджет',
  category: 'utility',
  icon: CodeIcon,
  description: 'Любой сторонний виджет по ссылке для встраивания',
  defaultProps: { embedUrl: '', height: 480, caption: '' },
  fields: embedFields,
  Renderer: EmbedRenderer,
});

// --- Scroll progress -------------------------------------------------------
// `position: fixed` только на публичном сайте, тот же приём `--preview`, что
// у `stickybar`/`popupoffer` (`blocks/content/index.tsx`) — канвас билдера
// рендерит блоки без изолирующего `<iframe>`, `fixed` внутри `isEditing`
// пробил бы холст насквозь. Позиция скролла — через `useScrollPosition`, не
// напрямую `window.scrollY`: реальная прокрутка на сайте идёт внутри
// кастомного `ScrollArea`, `window` тут ничего не видит (см. её комментарий
// — найдено вживую Playwright-проверкой, изначальная версия на `window`
// молча не работала ни на одной реальной странице).

interface ScrollProgressProps {
  color: 'primary' | 'text';
}

function ScrollProgressRenderer({ props, isEditing }: BlockRendererProps<ScrollProgressProps>) {
  const { ref, position } = useScrollPosition();
  const percent =
    position.scrollableHeight > 0 ? (position.scrollTop / position.scrollableHeight) * 100 : 0;

  return (
    <div
      ref={ref}
      className={cn(styles['scroll-progress'], isEditing && styles['scroll-progress--preview'])}
    >
      <div
        className={styles['scroll-progress__fill']}
        data-color={props.color}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

registerBlock<ScrollProgressProps>({
  type: 'scrollprogress',
  label: 'Индикатор прокрутки',
  category: 'utility',
  icon: ChevronUpIcon,
  description: 'Тонкая полоса вверху страницы — заполняется по мере прокрутки',
  defaultProps: { color: 'primary' },
  fields: [
    {
      key: 'color',
      label: 'Цвет',
      control: 'select',
      options: [
        { value: 'primary', label: 'Акцентный' },
        { value: 'text', label: 'Основной текст' },
      ],
    },
  ],
  Renderer: ScrollProgressRenderer,
});

// --- Back to top -----------------------------------------------------------
// Реф вешается на всегда смонтированный `display: contents`-якорь, не на
// саму кнопку — кнопка появляется в DOM только когда видна, а до этого
// момента `useScrollPosition` ещё не нашёл бы, за каким контейнером вообще
// следить (та же причина, по которой `visible` не может быть первым
// условием рендера).

interface BackToTopProps {
  showAfterPx: number;
}

function BackToTopRenderer({ props, isEditing }: BlockRendererProps<BackToTopProps>) {
  const { ref, position, scrollToTop } = useScrollPosition();
  const visible = isEditing || position.scrollTop > props.showAfterPx;

  function handleClick() {
    if (isEditing) return;
    scrollToTop();
  }

  return (
    <div ref={ref} className={styles['back-to-top__anchor']}>
      {visible && (
        <button
          type="button"
          className={cn(styles['back-to-top'], isEditing && styles['back-to-top--preview'])}
          aria-label="Наверх"
          onClick={handleClick}
        >
          <ChevronUpIcon />
        </button>
      )}
    </div>
  );
}

registerBlock<BackToTopProps>({
  type: 'backtotop',
  label: 'Кнопка «Наверх»',
  category: 'utility',
  icon: ChevronUpIcon,
  description: 'Плавающая кнопка возврата к началу страницы, появляется после прокрутки',
  defaultProps: { showAfterPx: 400 },
  fields: [
    {
      key: 'showAfterPx',
      label: 'Показывать после прокрутки (px)',
      control: 'number',
      min: 0,
      max: 5000,
    },
  ],
  Renderer: BackToTopRenderer,
});

// --- Scroll cue --------------------------------------------------------
// Обычная якорная ссылка (`LinkTarget`/`resolveLinkHref`, тот же контракт,
// что у любой другой кнопки в реестре), просто оформленная как
// подпрыгивающая стрелка — приглашение прокрутить дальше, обычно кладётся
// в конец `hero`-подобной секции.

interface ScrollCueProps {
  url: LinkTarget;
}

function ScrollCueRenderer({ props, pages }: BlockRendererProps<ScrollCueProps>) {
  return (
    <a
      href={resolveLinkHref(props.url, pages)}
      className={styles['scroll-cue']}
      aria-label="Прокрутить вниз"
    >
      <ChevronDownIcon />
    </a>
  );
}

registerBlock<ScrollCueProps>({
  type: 'scrollcue',
  label: 'Подсказка «прокрутите вниз»',
  category: 'utility',
  icon: ChevronDownIcon,
  description: 'Подпрыгивающая стрелка-приглашение прокрутить страницу дальше',
  defaultProps: { url: { type: 'anchor', anchor: 'about' } },
  fields: [{ key: 'url', label: 'Ссылка/якорь', control: 'link' }],
  Renderer: ScrollCueRenderer,
});

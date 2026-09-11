'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import {
  ChevronRightIcon,
  CloseIcon,
  ColumnsIcon,
  EyeIcon,
  ImageIcon,
  PinIcon,
  PlusIcon,
  VideoIcon,
} from '@/shared/ui/icons';
import { Popover } from '@/shared/ui/Popover';
import { useCarousel } from '../../lib/use-carousel';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import { EMPTY_LINK_TARGET, resolveLinkHref } from '../../model/resolve-link';
import type { LinkTarget } from '../../model/types';
import styles from './media.module.scss';

// --- Image -----------------------------------------------------------------

interface ImageProps {
  src: string | null;
  alt: string;
  objectFit: 'cover' | 'contain';
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  link: LinkTarget;
  width: 'auto' | 'full';
}

function ImageRenderer({ props, pages }: BlockRendererProps<ImageProps>) {
  if (!props.src) {
    return (
      <div className={styles['image-placeholder']}>
        <ImageIcon />
        <span>Выберите изображение</span>
      </div>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла, не подходит под next/image
    <img
      src={props.src}
      alt={props.alt}
      className={styles.image}
      data-fit={props.objectFit}
      data-radius={props.radius}
      data-width={props.width}
    />
  );

  const href = resolveLinkHref(props.link, pages);
  return href !== '#' ? (
    <a href={href} className={styles['image-link']}>
      {image}
    </a>
  ) : (
    image
  );
}

const imageFields: FieldSchema[] = [
  { key: 'src', label: 'Изображение', control: 'image' },
  { key: 'alt', label: 'Alt-текст', control: 'text', hint: 'Для доступности и SEO' },
  {
    key: 'objectFit',
    label: 'Заполнение',
    control: 'select',
    options: [
      { value: 'cover', label: 'Заполнить (обрезать)' },
      { value: 'contain', label: 'Вписать целиком' },
    ],
  },
  {
    key: 'radius',
    label: 'Скругление углов',
    control: 'select',
    options: [
      { value: 'none', label: 'Без скругления' },
      { value: 'sm', label: 'Небольшое' },
      { value: 'md', label: 'Среднее' },
      { value: 'lg', label: 'Крупное' },
      { value: 'full', label: 'Овал' },
    ],
  },
  { key: 'link', label: 'Ссылка при клике', control: 'link' },
  {
    key: 'width',
    label: 'Ширина',
    control: 'select',
    options: [
      { value: 'auto', label: 'По размеру фото' },
      { value: 'full', label: 'На всю ширину' },
    ],
  },
];

registerBlock<ImageProps>({
  type: 'image',
  label: 'Изображение',
  category: 'media',
  icon: ImageIcon,
  description: 'Одна фотография',
  defaultProps: {
    src: null,
    alt: '',
    objectFit: 'cover',
    radius: 'md',
    link: EMPTY_LINK_TARGET,
    width: 'full',
  },
  fields: imageFields,
  Renderer: ImageRenderer,
});

// --- Gallery -----------------------------------------------------------------

interface GalleryItem {
  url: string | null;
}

interface GalleryProps {
  images: GalleryItem[];
  columns: number;
}

function GalleryRenderer({ props }: BlockRendererProps<GalleryProps>) {
  const images = props.images.filter((item) => item.url);
  if (images.length === 0) {
    return (
      <div className={styles['image-placeholder']}>
        <ImageIcon />
        <span>Добавьте фотографии в галерею</span>
      </div>
    );
  }

  return (
    <div className={styles.gallery} style={{ '--gallery-columns': props.columns } as CSSProperties}>
      {images.map((item, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла
        <img key={index} src={item.url ?? undefined} alt="" className={styles['gallery__item']} />
      ))}
    </div>
  );
}

const galleryFields: FieldSchema[] = [
  {
    key: 'images',
    label: 'Фотографии',
    control: 'list',
    itemLabel: 'Фото',
    itemFields: [{ key: 'url', label: 'Изображение', control: 'image' }],
  },
  {
    key: 'columns',
    label: 'Колонок',
    control: 'number',
    min: 2,
    max: 5,
  },
];

registerBlock<GalleryProps>({
  type: 'gallery',
  label: 'Галерея',
  category: 'media',
  icon: ImageIcon,
  description: 'Сетка из нескольких фотографий',
  defaultProps: { images: [{ url: null }, { url: null }, { url: null }], columns: 3 },
  fields: galleryFields,
  Renderer: GalleryRenderer,
});

// --- Video -----------------------------------------------------------------

interface VideoProps {
  embedUrl: string;
  caption: string;
}

function VideoRenderer({ props }: BlockRendererProps<VideoProps>) {
  if (!props.embedUrl) {
    return (
      <div className={styles['image-placeholder']}>
        <VideoIcon />
        <span>Вставьте ссылку для встраивания видео</span>
      </div>
    );
  }

  return (
    <figure className={styles.video}>
      <div className={styles['video__frame']}>
        <iframe
          src={props.embedUrl}
          title={props.caption || 'Видео'}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
      {props.caption && (
        <figcaption className={styles['video__caption']}>{props.caption}</figcaption>
      )}
    </figure>
  );
}

const videoFields: FieldSchema[] = [
  {
    key: 'embedUrl',
    label: 'Ссылка для встраивания',
    control: 'url',
    hint: 'Например, ссылка «Встроить» из YouTube или Vimeo',
  },
  { key: 'caption', label: 'Подпись', control: 'text' },
];

registerBlock<VideoProps>({
  type: 'video',
  label: 'Видео',
  category: 'media',
  icon: VideoIcon,
  description: 'Встроенное видео с YouTube, Vimeo и т. п.',
  defaultProps: { embedUrl: '', caption: '' },
  fields: videoFields,
  Renderer: VideoRenderer,
});

// --- Logo --------------------------------------------------------------------

interface LogoProps {
  height: number;
}

function LogoRenderer({ props, business }: BlockRendererProps<LogoProps>) {
  if (!business.logoUrl) {
    return <span className={styles['logo-placeholder']}>{business.name}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- логотип бизнеса, загруженная пользователем картинка
    <img
      src={business.logoUrl}
      alt={business.name}
      className={styles.logo}
      style={{ height: props.height }}
    />
  );
}

const logoFields: FieldSchema[] = [
  { key: 'height', label: 'Высота (px)', control: 'number', min: 24, max: 160, step: 4 },
];

registerBlock<LogoProps>({
  type: 'logo',
  label: 'Логотип',
  category: 'media',
  icon: ImageIcon,
  description: 'Логотип бизнеса — подтягивается из карточки бизнеса',
  defaultProps: { height: 40 },
  fields: logoFields,
  Renderer: LogoRenderer,
});

// --- Image carousel ----------------------------------------------------
// Общий движок `imagecarousel`/`imagecarouselthumbs` — та же "один движок,
// один `type` на визуальный вариант" конвенция, что у `team`/`testimonials`
// (`blocks/business`) — различается только тем, показывается ли полоса
// миниатюр вместо точек навигации. Автопрокрутка/текущий слайд —
// `useCarousel` (`../../lib/use-carousel.ts`), общий и с `testimonialsslider`
// (`blocks/business`). Без drag-свайпа (только стрелки/точки/миниатюры) —
// осознанное упрощение этой партии, не пробел: надёжный pointer-based свайп
// с блокировкой вертикального скролла страницы — отдельная, более рискованная
// задача, не стоящая того в этой же итерации.

interface CarouselSlide {
  image: string | null;
  caption: string;
}

interface ImageCarouselProps {
  items: CarouselSlide[];
  autoPlay: boolean;
  interval: number;
}

const carouselFields: FieldSchema[] = [
  {
    key: 'items',
    label: 'Слайды',
    control: 'list',
    itemLabel: 'Слайд',
    max: 12,
    itemFields: [
      { key: 'image', label: 'Изображение', control: 'image' },
      { key: 'caption', label: 'Подпись', control: 'text' },
    ],
  },
  { key: 'autoPlay', label: 'Автопрокрутка', control: 'toggle' },
  { key: 'interval', label: 'Интервал автопрокрутки (сек)', control: 'number', min: 2, max: 15 },
];

const carouselDefaultProps: ImageCarouselProps = {
  items: [
    { image: null, caption: '' },
    { image: null, caption: '' },
    { image: null, caption: '' },
  ],
  autoPlay: false,
  interval: 5,
};

function ImageCarouselBlock({
  props,
  showThumbs,
}: {
  props: ImageCarouselProps;
  showThumbs: boolean;
}) {
  const slides = props.items.filter((item): item is CarouselSlide & { image: string } =>
    Boolean(item.image),
  );
  const { active, goTo, next, prev } = useCarousel(slides.length, props.autoPlay, props.interval);

  if (slides.length === 0) {
    return (
      <div className={styles['image-placeholder']}>
        <ImageIcon />
        <span>Добавьте фотографии в слайдер</span>
      </div>
    );
  }

  const current = slides[active] ?? slides[0];

  return (
    <div className={styles.carousel}>
      <div className={styles['carousel__stage']}>
        {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла, не подходит под next/image */}
        <img src={current.image} alt={current.caption} className={styles['carousel__image']} />
        {current.caption && <span className={styles['carousel__caption']}>{current.caption}</span>}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              className={cn(styles['carousel__arrow'], styles['carousel__arrow--prev'])}
              aria-label="Предыдущий слайд"
              onClick={prev}
            >
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              className={styles['carousel__arrow']}
              aria-label="Следующий слайд"
              onClick={next}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>
      {slides.length > 1 &&
        (showThumbs ? (
          <div className={styles['carousel__thumbs']} role="tablist">
            {slides.map((slide, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Слайд ${index + 1}`}
                className={cn(
                  styles['carousel__thumb'],
                  index === active && styles['carousel__thumb--active'],
                )}
                onClick={() => goTo(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- см. выше */}
                <img src={slide.image} alt="" />
              </button>
            ))}
          </div>
        ) : (
          <div className={styles['carousel__dots']} role="tablist">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={`Слайд ${index + 1}`}
                className={cn(
                  styles['carousel__dot'],
                  index === active && styles['carousel__dot--active'],
                )}
                onClick={() => goTo(index)}
              />
            ))}
          </div>
        ))}
    </div>
  );
}

function ImageCarouselRenderer({ props }: BlockRendererProps<ImageCarouselProps>) {
  return <ImageCarouselBlock props={props} showThumbs={false} />;
}

registerBlock<ImageCarouselProps>({
  type: 'imagecarousel',
  label: 'Слайдер изображений',
  category: 'media',
  icon: ImageIcon,
  description: 'Слайд-шоу из нескольких фотографий с точками навигации',
  defaultProps: carouselDefaultProps,
  fields: carouselFields,
  Renderer: ImageCarouselRenderer,
});

function ImageCarouselThumbsRenderer({ props }: BlockRendererProps<ImageCarouselProps>) {
  return <ImageCarouselBlock props={props} showThumbs={true} />;
}

registerBlock<ImageCarouselProps>({
  type: 'imagecarouselthumbs',
  label: 'Слайдер с миниатюрами',
  category: 'media',
  icon: ColumnsIcon,
  description: 'Слайд-шоу с полосой миниатюр для быстрой навигации',
  defaultProps: carouselDefaultProps,
  fields: carouselFields,
  Renderer: ImageCarouselThumbsRenderer,
});

// --- Before / after ------------------------------------------------------

interface BeforeAfterProps {
  beforeImage: string | null;
  afterImage: string | null;
  beforeLabel: string;
  afterLabel: string;
}

const beforeAfterFields: FieldSchema[] = [
  { key: 'beforeImage', label: 'Фото «До»', control: 'image' },
  { key: 'afterImage', label: 'Фото «После»', control: 'image' },
  { key: 'beforeLabel', label: 'Подпись «До»', control: 'text' },
  { key: 'afterLabel', label: 'Подпись «После»', control: 'text' },
];

const beforeAfterDefaultProps: BeforeAfterProps = {
  beforeImage: null,
  afterImage: null,
  beforeLabel: 'До',
  afterLabel: 'После',
};

/** Перетаскиваемый разделитель — слушатели на `window`, не на самом
 * элементе (иначе `pointerup`/`pointermove` за пределами блока, если палец/
 * курсор ушёл дальше границ во время реального перетаскивания, потерялись
 * бы), включаются один раз через `draggingRef`, не пересоздаются на каждый
 * рендер. `clip-path`, не сужение ширины вложенной обёртки — обе картинки
 * держат полный размер контейнера и просто по-разному обрезаются, поэтому
 * ни одна не искажается масштабированием под более узкий родитель. */
function BeforeAfterRenderer({ props }: BlockRendererProps<BeforeAfterProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [percent, setPercent] = useState(50);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, raw)));
  }, []);

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      if (draggingRef.current) updateFromClientX(event.clientX);
    }
    function handleUp() {
      draggingRef.current = false;
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [updateFromClientX]);

  if (!props.beforeImage || !props.afterImage) {
    return (
      <div className={styles['image-placeholder']}>
        <EyeIcon />
        <span>Добавьте оба изображения — «до» и «после»</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.beforeafter}
      onPointerDown={(event) => {
        draggingRef.current = true;
        updateFromClientX(event.clientX);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла */}
      <img src={props.afterImage} alt={props.afterLabel} className={styles['beforeafter__image']} />
      {/* eslint-disable-next-line @next/next/no-img-element -- см. выше */}
      <img
        src={props.beforeImage}
        alt={props.beforeLabel}
        className={styles['beforeafter__image']}
        style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
      />
      <div
        className={styles['beforeafter__handle']}
        style={{ left: `${percent}%` }}
        role="slider"
        tabIndex={0}
        aria-label="Сдвиньте, чтобы сравнить «до» и «после»"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') setPercent((p) => Math.max(0, p - 5));
          if (event.key === 'ArrowRight') setPercent((p) => Math.min(100, p + 5));
        }}
      >
        <span className={styles['beforeafter__handle-grip']} />
      </div>
      <span className={styles['beforeafter__label--before']}>{props.beforeLabel}</span>
      <span className={styles['beforeafter__label--after']}>{props.afterLabel}</span>
    </div>
  );
}

registerBlock<BeforeAfterProps>({
  type: 'beforeafter',
  label: 'До / после (слайдер)',
  category: 'media',
  icon: EyeIcon,
  description: 'Сравнение двух фото перетаскиваемым разделителем',
  defaultProps: beforeAfterDefaultProps,
  fields: beforeAfterFields,
  Renderer: BeforeAfterRenderer,
});

function BeforeAfterTabsRenderer({ props }: BlockRendererProps<BeforeAfterProps>) {
  const [active, setActive] = useState<'before' | 'after'>('before');

  if (!props.beforeImage || !props.afterImage) {
    return (
      <div className={styles['image-placeholder']}>
        <EyeIcon />
        <span>Добавьте оба изображения — «до» и «после»</span>
      </div>
    );
  }

  const src = active === 'before' ? props.beforeImage : props.afterImage;
  const label = active === 'before' ? props.beforeLabel : props.afterLabel;

  return (
    <div className={styles['beforeafter-tabs']}>
      {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла */}
      <img src={src} alt={label} className={styles['beforeafter-tabs__image']} />
      <div className={styles['beforeafter-tabs__switch']} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'before'}
          className={cn(
            styles['beforeafter-tabs__button'],
            active === 'before' && styles['beforeafter-tabs__button--active'],
          )}
          onClick={() => setActive('before')}
        >
          {props.beforeLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'after'}
          className={cn(
            styles['beforeafter-tabs__button'],
            active === 'after' && styles['beforeafter-tabs__button--active'],
          )}
          onClick={() => setActive('after')}
        >
          {props.afterLabel}
        </button>
      </div>
    </div>
  );
}

registerBlock<BeforeAfterProps>({
  type: 'beforeaftertabs',
  label: 'До / после (переключатель)',
  category: 'media',
  icon: ChevronRightIcon,
  description: 'Сравнение двух фото кнопками-переключателями',
  defaultProps: beforeAfterDefaultProps,
  fields: beforeAfterFields,
  Renderer: BeforeAfterTabsRenderer,
});

// --- Gallery with lightbox -----------------------------------------------
// Общий движок `gallerylightbox`/`gallerylightboxmasonry` — та же
// "модификатор на элементе, не через селектор-потомок" дисциплина, что и у
// `portfoliogrid`/`portfoliomasonry` (`blocks/content`, см. её комментарий).
// В билдере (`isEditing`) клик по миниатюре НЕ открывает лайтбокс — тот же
// принцип, что у `FormBlock`'s «форма не должна реально отправляться, пока
// её редактируют»: полноэкранная подложка при отсутствии изолирующего
// `<iframe>` вокруг канваса пробила бы его насквозь (см. `StickyBarRenderer`
// в `blocks/content` — тот же самый класс проблемы, уже однажды найденный
// самостоятельным ревью и исправленный там).

interface LightboxItem {
  url: string | null;
  caption: string;
}

interface GalleryLightboxProps {
  images: LightboxItem[];
  columns: number;
}

const lightboxFields: FieldSchema[] = [
  {
    key: 'images',
    label: 'Фотографии',
    control: 'list',
    itemLabel: 'Фото',
    itemFields: [
      { key: 'url', label: 'Изображение', control: 'image' },
      { key: 'caption', label: 'Подпись', control: 'text' },
    ],
  },
  { key: 'columns', label: 'Колонок', control: 'number', min: 2, max: 5 },
];

const lightboxDefaultProps: GalleryLightboxProps = {
  images: [
    { url: null, caption: '' },
    { url: null, caption: '' },
    { url: null, caption: '' },
  ],
  columns: 3,
};

function GalleryLightboxBlock({
  props,
  isEditing,
  masonry,
}: BlockRendererProps<GalleryLightboxProps> & { masonry: boolean }) {
  const images = props.images.filter((item): item is LightboxItem & { url: string } =>
    Boolean(item.url),
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null || images.length === 0) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIndex(null);
      if (event.key === 'ArrowRight') {
        setOpenIndex((current) => (current === null ? null : (current + 1) % images.length));
      }
      if (event.key === 'ArrowLeft') {
        setOpenIndex((current) =>
          current === null ? null : (current - 1 + images.length) % images.length,
        );
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openIndex, images.length]);

  if (images.length === 0) {
    return (
      <div className={styles['image-placeholder']}>
        <ImageIcon />
        <span>Добавьте фотографии в галерею</span>
      </div>
    );
  }

  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <div className={styles.block}>
      <div
        className={styles[masonry ? 'lightbox-masonry' : 'lightbox-grid']}
        style={{ '--grid-columns': props.columns } as CSSProperties}
      >
        {images.map((item, index) => (
          <button
            key={index}
            type="button"
            className={cn(styles['lightbox-thumb'], masonry && styles['lightbox-thumb--masonry'])}
            aria-label={item.caption || `Открыть фото ${index + 1}`}
            onClick={() => {
              if (!isEditing) setOpenIndex(index);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла */}
            <img
              src={item.url}
              alt=""
              className={cn(
                styles['lightbox-thumb__image'],
                masonry && styles['lightbox-thumb__image--natural'],
              )}
            />
          </button>
        ))}
      </div>
      {current && (
        <div className={styles['lightbox-backdrop']} onClick={() => setOpenIndex(null)}>
          <button
            type="button"
            className={styles['lightbox-close']}
            aria-label="Закрыть"
            onClick={() => setOpenIndex(null)}
          >
            <CloseIcon />
          </button>
          {images.length > 1 && (
            <button
              type="button"
              className={cn(styles['lightbox-nav'], styles['lightbox-nav--prev'])}
              aria-label="Предыдущее фото"
              onClick={(event) => {
                event.stopPropagation();
                setOpenIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));
              }}
            >
              <ChevronRightIcon />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла */}
          <img
            src={current.url}
            alt={current.caption}
            className={styles['lightbox-full']}
            onClick={(event) => event.stopPropagation()}
          />
          {images.length > 1 && (
            <button
              type="button"
              className={styles['lightbox-nav']}
              aria-label="Следующее фото"
              onClick={(event) => {
                event.stopPropagation();
                setOpenIndex((i) => (i === null ? null : (i + 1) % images.length));
              }}
            >
              <ChevronRightIcon />
            </button>
          )}
          {current.caption && <span className={styles['lightbox-caption']}>{current.caption}</span>}
        </div>
      )}
    </div>
  );
}

function GalleryLightboxRenderer(rendererProps: BlockRendererProps<GalleryLightboxProps>) {
  return <GalleryLightboxBlock {...rendererProps} masonry={false} />;
}

registerBlock<GalleryLightboxProps>({
  type: 'gallerylightbox',
  label: 'Галерея с просмотром',
  category: 'media',
  icon: EyeIcon,
  description: 'Сетка фото — клик открывает полноэкранный просмотр с навигацией',
  defaultProps: lightboxDefaultProps,
  fields: lightboxFields,
  Renderer: GalleryLightboxRenderer,
});

function GalleryLightboxMasonryRenderer(rendererProps: BlockRendererProps<GalleryLightboxProps>) {
  return <GalleryLightboxBlock {...rendererProps} masonry={true} />;
}

registerBlock<GalleryLightboxProps>({
  type: 'gallerylightboxmasonry',
  label: 'Галерея-плитка с просмотром',
  category: 'media',
  icon: ColumnsIcon,
  description: 'Плитка фото переменной высоты — клик открывает полноэкранный просмотр',
  defaultProps: lightboxDefaultProps,
  fields: lightboxFields,
  Renderer: GalleryLightboxMasonryRenderer,
});

// --- Image hotspot -----------------------------------------------------
// Метки — `x`/`y` в процентах (0–100) от размеров картинки, не пиксели —
// та же логика, что у любого адаптивного позиционирования: метка должна
// оставаться на том же месте фото при любой ширине блока. Готовый попап
// (`shared/ui/Popover`) вместо своего велосипеда закрытия по клику-вне/
// Escape — тот же примитив, что у выпадающего меню шапки сайта
// (`blocks/business/index.tsx`'s `NavItem`).

interface Hotspot {
  x: number;
  y: number;
  label: string;
  description: string;
}

interface ImageHotspotProps {
  image: string | null;
  hotspots: Hotspot[];
}

function ImageHotspotMarker({ hotspot }: { hotspot: Hotspot }) {
  return (
    <div
      className={styles['hotspot__marker-wrap']}
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
    >
      <Popover
        panelLabel={hotspot.label}
        align={hotspot.x > 50 ? 'end' : 'start'}
        panelClassName={styles['hotspot__panel']}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            className={cn(styles['hotspot__marker'], open && styles['hotspot__marker--open'])}
            aria-label={hotspot.label}
            aria-expanded={open}
            onClick={toggle}
          >
            <PlusIcon />
          </button>
        )}
      >
        {() => (
          <div className={styles['hotspot__content']}>
            <span className={styles['hotspot__label']}>{hotspot.label}</span>
            {hotspot.description && (
              <p className={styles['hotspot__description']}>{hotspot.description}</p>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}

function ImageHotspotRenderer({ props }: BlockRendererProps<ImageHotspotProps>) {
  if (!props.image) {
    return (
      <div className={styles['image-placeholder']}>
        <ImageIcon />
        <span>Выберите изображение</span>
      </div>
    );
  }

  return (
    <div className={styles.hotspot}>
      {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла, не подходит под next/image */}
      <img src={props.image} alt="" className={styles['hotspot__image']} />
      {props.hotspots.map((hotspot, index) => (
        <ImageHotspotMarker key={index} hotspot={hotspot} />
      ))}
    </div>
  );
}

registerBlock<ImageHotspotProps>({
  type: 'imagehotspot',
  label: 'Изображение с метками',
  category: 'media',
  icon: PinIcon,
  description: 'Фото с кликабельными точками — при клике всплывает подсказка',
  defaultProps: {
    image: null,
    hotspots: [
      { x: 30, y: 40, label: 'Материал', description: 'Натуральное дерево, ручная обработка.' },
      { x: 70, y: 60, label: 'Фурнитура', description: 'Металлические детали премиум-класса.' },
    ],
  },
  fields: [
    { key: 'image', label: 'Изображение', control: 'image' },
    {
      key: 'hotspots',
      label: 'Метки',
      control: 'list',
      itemLabel: 'Метка',
      max: 10,
      itemFields: [
        { key: 'x', label: 'Позиция по горизонтали, %', control: 'number', min: 0, max: 100 },
        { key: 'y', label: 'Позиция по вертикали, %', control: 'number', min: 0, max: 100 },
        { key: 'label', label: 'Заголовок', control: 'text' },
        { key: 'description', label: 'Описание', control: 'textarea', rows: 2 },
      ],
    },
  ],
  Renderer: ImageHotspotRenderer,
});

// --- Video gallery -----------------------------------------------------
// Сетка НЕСКОЛЬКИХ видео — не третий вариант одиночного `video` выше:
// переиспользует его же `.video`/`.video__frame`/`.video__caption` классы
// на каждую ячейку сетки, просто в `grid`, а не по одному блоку `video` на
// видео. Без `eyebrow`/`heading`, как и весь остальной `media` — рамку с
// заголовком владелец собирает сам через `section`/`container` вокруг.

interface VideoGalleryItem {
  embedUrl: string;
  caption: string;
}

interface VideoGalleryProps {
  items: VideoGalleryItem[];
  columns: number;
}

function VideoGalleryRenderer({ props }: BlockRendererProps<VideoGalleryProps>) {
  return (
    <div
      className={styles['video-gallery']}
      style={{ '--video-gallery-columns': props.columns } as CSSProperties}
    >
      {props.items.map((item, index) => (
        <figure key={index} className={styles.video}>
          {item.embedUrl ? (
            <div className={styles['video__frame']}>
              <iframe
                src={item.embedUrl}
                title={item.caption || `Видео ${index + 1}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className={styles['image-placeholder']}>
              <VideoIcon />
              <span>Вставьте ссылку для встраивания видео</span>
            </div>
          )}
          {item.caption && (
            <figcaption className={styles['video__caption']}>{item.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

registerBlock<VideoGalleryProps>({
  type: 'videogallery',
  label: 'Галерея видео',
  category: 'media',
  icon: VideoIcon,
  description: 'Сетка из нескольких встроенных видео',
  defaultProps: {
    items: [
      { embedUrl: '', caption: 'Видео 1' },
      { embedUrl: '', caption: 'Видео 2' },
    ],
    columns: 2,
  },
  fields: [
    {
      key: 'items',
      label: 'Видео',
      control: 'list',
      itemLabel: 'Видео',
      max: 12,
      itemFields: [
        {
          key: 'embedUrl',
          label: 'Ссылка для встраивания',
          control: 'url',
          hint: 'Например, ссылка «Встроить» из YouTube или Vimeo',
        },
        { key: 'caption', label: 'Подпись', control: 'text' },
      ],
    },
    { key: 'columns', label: 'Колонок', control: 'number', min: 1, max: 3 },
  ],
  Renderer: VideoGalleryRenderer,
});

// --- Audio embed -------------------------------------------------------
// Тот же принцип, что у `video`/`videogallery` — ссылка для встраивания
// (Spotify/SoundCloud/подкаст-хостинг), не файл: не заводит нового типа
// загружаемого ассета ради одного блока. Высота настраивается — у
// разных сервисов виджет разной высоты (Spotify — обычно 152px).

interface AudioEmbedProps {
  embedUrl: string;
  height: number;
  caption: string;
}

function AudioEmbedRenderer({ props }: BlockRendererProps<AudioEmbedProps>) {
  if (!props.embedUrl) {
    return (
      <div className={styles['image-placeholder']}>
        <VideoIcon />
        <span>Вставьте ссылку для встраивания аудио</span>
      </div>
    );
  }

  return (
    <figure className={styles['audio-embed']}>
      <iframe
        src={props.embedUrl}
        title={props.caption || 'Аудио'}
        allow="autoplay; encrypted-media"
        style={{ height: props.height }}
      />
      {props.caption && (
        <figcaption className={styles['video__caption']}>{props.caption}</figcaption>
      )}
    </figure>
  );
}

registerBlock<AudioEmbedProps>({
  type: 'audioembed',
  label: 'Аудио',
  category: 'media',
  icon: VideoIcon,
  description: 'Встроенный аудиоплеер — подкаст, трек, аудио-отзыв',
  defaultProps: { embedUrl: '', height: 152, caption: '' },
  fields: [
    {
      key: 'embedUrl',
      label: 'Ссылка для встраивания',
      control: 'url',
      hint: 'Например, ссылка «Встроить» из Spotify или SoundCloud',
    },
    { key: 'height', label: 'Высота (px)', control: 'number', min: 80, max: 400, step: 4 },
    { key: 'caption', label: 'Подпись', control: 'text' },
  ],
  Renderer: AudioEmbedRenderer,
});

// --- Image with caption overlay -----------------------------------------
// Не третий вариант `hero`/`about` — у тех есть кнопки/CTA и фиксированная
// раскладка «текст + картинка рядом». Здесь ровно одна картинка с
// подписью, наложенной поверх (постер/цитата-на-фото), для мест, где
// хиро-обвязка была бы лишней.

interface ImageCaptionProps {
  image: string | null;
  eyebrow: string;
  caption: string;
  align: 'left' | 'center' | 'right';
}

function ImageCaptionRenderer({ props }: BlockRendererProps<ImageCaptionProps>) {
  if (!props.image) {
    return (
      <div className={styles['image-placeholder']}>
        <ImageIcon />
        <span>Выберите изображение</span>
      </div>
    );
  }

  return (
    <div className={styles['image-caption']}>
      {/* eslint-disable-next-line @next/next/no-img-element -- превью загруженного пользователем файла, не подходит под next/image */}
      <img src={props.image} alt="" className={styles['image-caption__image']} />
      <div
        className={cn(
          styles['image-caption__overlay'],
          styles[`image-caption__overlay--${props.align}`],
        )}
      >
        {props.eyebrow && <span className={styles['image-caption__eyebrow']}>{props.eyebrow}</span>}
        <p className={styles['image-caption__text']}>{props.caption}</p>
      </div>
    </div>
  );
}

registerBlock<ImageCaptionProps>({
  type: 'imagecaption',
  label: 'Фото с подписью поверх',
  category: 'media',
  icon: ImageIcon,
  description: 'Фото с текстом, наложенным поверх снизу',
  defaultProps: {
    image: null,
    eyebrow: '',
    caption: 'Ваша история начинается здесь',
    align: 'left',
  },
  fields: [
    { key: 'image', label: 'Изображение', control: 'image' },
    { key: 'eyebrow', label: 'Надпись сверху', control: 'text' },
    { key: 'caption', label: 'Подпись', control: 'text' },
    {
      key: 'align',
      label: 'Выравнивание',
      control: 'segmented',
      options: [
        { value: 'left', label: 'Слева' },
        { value: 'center', label: 'По центру' },
        { value: 'right', label: 'Справа' },
      ],
    },
  ],
  Renderer: ImageCaptionRenderer,
});

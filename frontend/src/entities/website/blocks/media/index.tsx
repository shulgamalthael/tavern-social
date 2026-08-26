import type { CSSProperties } from 'react';
import { ImageIcon, VideoIcon } from '@/shared/ui/icons';
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

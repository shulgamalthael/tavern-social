import type { ComponentType } from 'react';
import type { IconProps } from '@/shared/ui/icons';
import { PreviewColumnsIcon, PreviewContainerIcon, PreviewFullWidthIcon } from '@/shared/ui/icons';
import { createBlockId } from './block-tree';
import type { BlockStyle, WebsiteBlock } from './types';

function column(style: BlockStyle, children: WebsiteBlock[]): WebsiteBlock {
  return { id: createBlockId(), type: 'column', props: {}, style, children };
}

function heading(text: string): WebsiteBlock {
  return {
    id: createBlockId(),
    type: 'heading',
    props: { text, level: 'h3', size: { desktop: 'md' }, color: 'default' },
  };
}

function paragraph(text: string): WebsiteBlock {
  return { id: createBlockId(), type: 'text', props: { text: `<p>${text}</p>`, color: 'default' } };
}

export interface LayoutPattern {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
  /** Готовое дерево блоков (один корневой `section`) — id внутри произвольные
   * (`createBlockId()`, не связаны со стором) — всё равно перезаписываются
   * `remapBlockIds` при вставке через `insertWidgetBlocks`, тем же путём,
   * что и сохранённые «Мои виджеты» (Custom Widget Engine, §16.2) — вставка
   * готового макета технически ничем не отличается от вставки виджета,
   * просто источник дерева — этот файл, а не сохранённая запись бизнеса. */
  build: () => WebsiteBlock[];
}

/**
 * Готовые составленные раскладки — ответ на находку аудита (§45.1): новичок,
 * выбравший «Секция»/«Колонки» из «Структура», получает пустые контейнеры
 * без вообще ничего настроенного и должен вручную дойти до вкладки
 * «Раскладка», понять display/direction/gap/grow/sticky и настроить каждую
 * колонку отдельно — то же самое умеют топ-конкуренты (Squarespace особенно)
 * одним кликом: готовая, уже стилизованная секция. Строятся на уже
 * существующей универсальной системе раскладки (§37.3, `set_style`'s
 * `display`/`direction`/`gap`/`grow`/`fixedWidth`/`sticky`) — ничего нового
 * в модели данных, просто curated-комбинация уже существующих полей плюс
 * несколько типографических блоков-заглушек внутри, чтобы вставленный макет
 * сразу было что редактировать, а не снова пустой контейнер.
 */
export const LAYOUT_PATTERNS: LayoutPattern[] = [
  {
    id: 'sidebar',
    label: 'Сайдбар + контент',
    description:
      'Узкая колонка слева (категории, фильтры) и широкая справа — прилипает при прокрутке',
    icon: PreviewColumnsIcon,
    build: () => [
      {
        id: createBlockId(),
        type: 'section',
        props: {},
        children: [
          {
            id: createBlockId(),
            type: 'columns',
            props: {},
            style: { display: 'flex', direction: { desktop: 'row', mobile: 'column' }, gap: 'lg' },
            children: [
              column({ grow: 'fixed', fixedWidth: 260, sticky: true, stickyOffset: 20 }, [
                heading('Категории'),
                paragraph('Список категорий, фильтры или навигация — замените этот текст своим.'),
              ]),
              column({ grow: 'grow' }, [
                heading('Заголовок раздела'),
                paragraph('Основной контент — товары, услуги, текст или любые другие блоки.'),
              ]),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'two-columns',
    label: 'Две колонки',
    description: 'Ровно пополам — например, текст слева и фото справа',
    icon: PreviewContainerIcon,
    build: () => [
      {
        id: createBlockId(),
        type: 'section',
        props: {},
        children: [
          {
            id: createBlockId(),
            type: 'columns',
            props: {},
            style: { display: 'flex', direction: { desktop: 'row', mobile: 'column' }, gap: 'lg' },
            children: [
              column({ grow: 'grow' }, [
                heading('Первая колонка'),
                paragraph('Расскажите здесь первую часть истории.'),
              ]),
              column({ grow: 'grow' }, [
                heading('Вторая колонка'),
                paragraph('А здесь — вторую, или добавьте изображение вместо текста.'),
              ]),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'three-columns',
    label: 'Три колонки',
    description: 'Ряд из трёх равных карточек — преимущества, шаги, услуги',
    icon: PreviewFullWidthIcon,
    build: () => [
      {
        id: createBlockId(),
        type: 'section',
        props: {},
        children: [
          {
            id: createBlockId(),
            type: 'columns',
            props: {},
            style: {
              display: 'flex',
              direction: { desktop: 'row', mobile: 'column' },
              gap: 'md',
              wrap: true,
            },
            children: [
              column({ grow: 'grow' }, [
                heading('Первое'),
                paragraph('Короткое описание первого пункта.'),
              ]),
              column({ grow: 'grow' }, [
                heading('Второе'),
                paragraph('Короткое описание второго пункта.'),
              ]),
              column({ grow: 'grow' }, [
                heading('Третье'),
                paragraph('Короткое описание третьего пункта.'),
              ]),
            ],
          },
        ],
      },
    ],
  },
];

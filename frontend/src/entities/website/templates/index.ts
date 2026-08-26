import { BedIcon, BriefcaseIcon, GridIcon, UtensilsIcon } from '@/shared/ui/icons';
import type { IconProps } from '@/shared/ui/icons';
import type { ComponentType } from 'react';
import type { WebsiteBlock } from '../model/types';
import { agencyTemplate } from './agency';
import { localBusinessTemplate } from './local-business';
import { restaurantTemplate } from './restaurant';

/** Пример строки-«блюда» для сидинга каталога вместе с шаблоном — см.
 * `StarterTemplate.seedProducts`. */
export interface TemplateSeedProduct {
  name: string;
  description?: string;
  priceCents: number;
}

/** Пример строки-«услуги» (для ресторана — бронирование столика) — см.
 * `StarterTemplate.seedServices`. */
export interface TemplateSeedService {
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
}

export interface StarterTemplate {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<IconProps>;
  build: (businessName: string) => WebsiteBlock[];
  /** Капабилити, которые стоит включить вместе с шаблоном (нетипизировано
   * на `BusinessCapability` намеренно — тот же приём, что и у
   * `BlockDefinition.capability` в `registry.ts`: `entities/website` не
   * имеет права импортировать типы из `entities/business`, лежащего на
   * том же слое FSD). Пустой список/отсутствие поля — шаблон без
   * привязанной капабилити (как у `agency`/`local-business` сегодня). */
  capabilities?: string[];
  /** 1-2 примера товаров, создаваемых вызывающим кодом (см. `Starter
   * TemplatePicker.tsx`) сразу вместе с включением капабилити — чтобы
   * `productgrid`-блок этого же шаблона не показывал пустой каталог в
   * день создания сайта (см. ROADMAP.md §3.12/§8 Phase 8). */
  seedProducts?: TemplateSeedProduct[];
  /** То же самое для `servicegrid` — см. `seedProducts`. */
  seedServices?: TemplateSeedService[];
}

/**
 * Стартовые наборы блоков — выбираются один раз при первом входе в билдер
 * пустого сайта (см. `widgets/website-builder/ui/StarterTemplatePicker.tsx`).
 * `blank` не в этом списке (см. отдельную кнопку «С чистого листа» в самом
 * пикере) — не шаблон, а явное «ничего не подставлять».
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'restaurant',
    label: 'Кафе / ресторан',
    description: 'Заглавный блок, о заведении, меню, галерея, отзывы, контакты',
    icon: UtensilsIcon,
    build: restaurantTemplate,
    capabilities: ['commerce', 'booking'],
    seedProducts: [
      { name: 'Борщ', description: 'Наваристый борщ со сметаной и зеленью', priceCents: 45000 },
      { name: 'Чизкейк', description: 'Классический чизкейк с ягодным соусом', priceCents: 32000 },
    ],
    seedServices: [
      {
        name: 'Столик на 2 персоны',
        description: 'Бронирование столика на двоих',
        durationMinutes: 90,
        priceCents: 0,
      },
    ],
  },
  {
    id: 'agency',
    label: 'Агентство / студия',
    description: 'Заглавный блок, услуги, проекты, о команде, отзывы, контакты',
    icon: GridIcon,
    build: agencyTemplate,
    capabilities: ['booking'],
    seedServices: [
      {
        name: 'Консультация',
        description: 'Обсудим задачу и предложим подход — по видеосвязи или у нас в офисе',
        durationMinutes: 30,
        priceCents: 0,
      },
    ],
  },
  {
    id: 'local-business',
    label: 'Локальный бизнес',
    description: 'Заглавный блок, услуги, часы работы, локация, отзывы, контакты',
    icon: BedIcon,
    build: localBusinessTemplate,
    capabilities: ['booking'],
    seedServices: [
      {
        name: 'Консультация',
        description: 'Расскажем подробнее об услуге и подберём удобное время',
        durationMinutes: 30,
        priceCents: 0,
      },
    ],
  },
];

export const BLANK_TEMPLATE_ICON: ComponentType<IconProps> = BriefcaseIcon;

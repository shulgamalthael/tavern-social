import type { WebsiteBlock } from '../model/types';
import { block, section } from './helpers';

/** Hero → About → Меню (`productgrid`) → Галерея → Бронирование
 * (`servicegrid`) → Отзывы → Контакты. `productgrid`/`servicegrid` —
 * настоящие блоки с данными (та же капабилити-инфраструктура, что и у
 * Commerce/Booking), не статичные карточки-заглушки — вызывающий код
 * (`StarterTemplatePicker.tsx`) включает капабилити `commerce`/`booking` и
 * создаёт по паре примеров товаров/услуг вместе с применением этого
 * шаблона (см. `StarterTemplate.seedProducts`/`seedServices` в
 * `templates/index.ts`), поэтому эти блоки не пустуют в день создания
 * сайта. ROADMAP.md §3.12/§8 Phase 8: "Restaurant isn't a fifth
 * capability, it's Commerce + Booking... on top" — здесь именно это и
 * происходит, без единой новой Prisma-модели. */
export function restaurantTemplate(businessName: string): WebsiteBlock[] {
  return [
    block('businessheader'),
    section(
      [
        block('hero', {
          eyebrow: 'Добро пожаловать',
          heading: businessName,
          description: 'Домашняя кухня и тёплая атмосфера в самом центре города.',
          buttonLabel: 'Забронировать столик',
          buttonUrl: '#contact',
          secondaryLabel: 'Посмотреть меню',
          secondaryUrl: '#services',
        }),
      ],
      { paddingY: 'xl', textAlign: 'center' },
    ),
    section([
      block('about', {
        eyebrow: 'Наша история',
        heading: 'О ресторане',
        text: 'Мы готовим из свежих локальных продуктов и подаём блюда с душой — каждый рецепт проверен временем и гостями.',
      }),
    ]),
    section(
      [
        block('productgrid', {
          eyebrow: 'Меню',
          heading: 'Популярные блюда',
          description: '',
          dataSource: { limit: 6, sort: 'newest' },
          columns: 3,
        }),
      ],
      { background: 'surface', paddingY: 'lg' },
    ),
    section([
      block('gallery', {
        images: [{ url: null }, { url: null }, { url: null }, { url: null }],
        columns: 4,
      }),
    ]),
    section(
      [
        block('servicegrid', {
          eyebrow: 'Бронирование',
          heading: 'Забронировать столик',
          description: '',
          dataSource: { limit: 3, sort: 'newest' },
          columns: 3,
        }),
      ],
      { paddingY: 'lg' },
    ),
    section(
      [
        block('reviews', {
          eyebrow: 'Отзывы',
          heading: 'Нас рекомендуют',
        }),
      ],
      { background: 'surface', paddingY: 'lg' },
    ),
    section([
      block('contact', { eyebrow: 'Контакты', heading: 'Ждём вас в гости' }),
      block('openinghours', {}),
    ]),
    block('footer'),
  ];
}

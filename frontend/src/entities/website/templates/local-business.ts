import type { WebsiteBlock } from '../model/types';
import { block, section } from './helpers';

/** Hero → Услуги (`servicegrid`) → Часы работы → Расположение → Отзывы →
 * Контакты.
 *
 * «Услуги» здесь — настоящий `servicegrid`, не статичные карточки-заглушки
 * (в отличие от `agencyTemplate`, где «Услуги» — широкие категории
 * специализации, а не список бронируемых позиций, см. её комментарий):
 * плейсхолдеры «Первая услуга»/«Вторая услуга»/«Третья услуга», которые
 * были здесь раньше, один в один соответствуют реальным бронируемым
 * позициям — тот же случай, что и ресторанное «Меню» → `productgrid` (см.
 * ROADMAP.md §3.12/§8 Phase 8/12). Капабилити `booking` включается и
 * пример услуги создаётся вызывающим кодом вместе с применением шаблона
 * (см. `StarterTemplate.capabilities`/`seedServices` в `templates/index.ts`). */
export function localBusinessTemplate(businessName: string): WebsiteBlock[] {
  return [
    block('businessheader'),
    section(
      [
        block('hero', {
          eyebrow: 'Рядом с вами',
          heading: businessName,
          description: 'Проверенный местный сервис, которому доверяют соседи.',
          buttonLabel: 'Позвонить',
          buttonUrl: '#contact',
        }),
      ],
      { paddingY: 'xl', textAlign: 'center' },
    ),
    section(
      [
        block('servicegrid', {
          eyebrow: 'Услуги',
          heading: 'Что мы предлагаем',
          description: '',
          dataSource: { limit: 6, sort: 'newest' },
          columns: 3,
        }),
      ],
      { background: 'surface', paddingY: 'lg' },
    ),
    section([block('openinghours', {})]),
    section([block('location', { heading: 'Как нас найти' })], {
      background: 'surface',
      paddingY: 'lg',
    }),
    section([block('reviews', { eyebrow: 'Отзывы', heading: 'Нас рекомендуют соседи' })]),
    section([block('contact', { eyebrow: 'Контакты', heading: 'Свяжитесь с нами' })], {
      background: 'surface',
      paddingY: 'lg',
    }),
    block('footer'),
  ];
}

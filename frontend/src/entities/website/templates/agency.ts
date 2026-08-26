import type { WebsiteBlock } from '../model/types';
import { block, section } from './helpers';

/** Hero → Услуги → Проекты → О нас → Записаться на консультацию
 * (`servicegrid`) → Отзывы → Контакты.
 *
 * «Услуги» (Дизайн/Разработка/Стратегия) остаётся статичным блоком
 * `services`, не превращается в `servicegrid` — в отличие от ресторанного
 * «Меню» (где список блюд один в один совпадает с настоящими `Product`),
 * здесь это широкие категории специализации агентства, а не список
 * бронируемых позиций; заменить их единственной затравочной услугой
 * «Консультация» значило бы обеднить шаблон, а не улучшить его. Вместо
 * этого `servicegrid` — ДОПОЛНИТЕЛЬНАЯ секция для реальной записи на
 * консультацию (см. `StarterTemplate.capabilities`/`seedServices` в
 * `templates/index.ts`, ROADMAP.md §3.12/§8 Phase 12), а не замена. */
export function agencyTemplate(businessName: string): WebsiteBlock[] {
  return [
    block('businessheader'),
    section(
      [
        block('hero', {
          eyebrow: 'Студия',
          heading: businessName,
          description: 'Создаём продукты, которыми гордимся вместе с клиентами.',
          buttonLabel: 'Обсудить проект',
          buttonUrl: '#contact',
        }),
      ],
      { paddingY: 'xl', textAlign: 'center', background: 'dark' },
    ),
    section([
      block('services', {
        eyebrow: 'Услуги',
        heading: 'Чем мы занимаемся',
        items: [
          { icon: 'sparkle', title: 'Дизайн', description: 'От концепции до финального макета.' },
          { icon: 'cpu', title: 'Разработка', description: 'Быстро, надёжно, современно.' },
          {
            icon: 'chart',
            title: 'Стратегия',
            description: 'Понимаем цели бизнеса, не только красоту.',
          },
        ],
        columns: 3,
      }),
    ]),
    section(
      [
        block('cards', {
          eyebrow: 'Портфолио',
          heading: 'Наши проекты',
          items: [
            {
              image: null,
              title: 'Проект первый',
              description: 'Короткое описание результата.',
              meta: '',
              url: '',
            },
            {
              image: null,
              title: 'Проект второй',
              description: 'Короткое описание результата.',
              meta: '',
              url: '',
            },
            {
              image: null,
              title: 'Проект третий',
              description: 'Короткое описание результата.',
              meta: '',
              url: '',
            },
          ],
          columns: 3,
        }),
      ],
      { background: 'surface', paddingY: 'lg' },
    ),
    section([
      block('about', {
        eyebrow: 'О студии',
        heading: 'Кто мы',
        text: 'Команда специалистов, объединённых любовью к качественным продуктам и вниманием к деталям.',
      }),
    ]),
    section([
      block('servicegrid', {
        eyebrow: 'Начать',
        heading: 'Записаться на консультацию',
        description: '',
        dataSource: { limit: 3, sort: 'newest' },
        columns: 3,
      }),
    ]),
    section([block('testimonials', { eyebrow: 'Отзывы', heading: 'Что говорят клиенты' })], {
      background: 'surface',
      paddingY: 'lg',
    }),
    section([block('contact', { eyebrow: 'Контакты', heading: 'Начнём работать?' })]),
    block('footer'),
  ];
}

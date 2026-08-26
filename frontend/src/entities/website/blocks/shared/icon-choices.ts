import {
  BriefcaseIcon,
  BuildingIcon,
  ChartIcon,
  CheckIcon,
  ClockIcon,
  CpuIcon,
  DumbbellIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  type IconProps,
  MailIcon,
  ShieldIcon,
  ShoppingBagIcon,
  SparkleIcon,
  StarIcon,
  UtensilsIcon,
} from '@/shared/ui/icons';
import type { ComponentType } from 'react';
import type { SelectOption } from '../../model/registry';

/**
 * Небольшой курируемый набор иконок для полей вида «иконка для карточки»
 * (услуги/преимущества/статы и т. п., см. `RepeatableIconCards`) — не
 * полноценный icon-picker с сотнями вариантов (то отдельная фича сама по
 * себе), а разумный набор, которого достаточно для большинства бизнес-
 * сайтов. Ключ хранится в `props` как обычная строка (`item.icon`), поэтому
 * добавить сюда новый вариант позже — не breaking change для уже
 * сохранённых сайтов, у них просто останется валидный старый ключ.
 */
export const ICON_CHOICES: Record<string, ComponentType<IconProps>> = {
  star: StarIcon,
  heart: HeartIcon,
  check: CheckIcon,
  shield: ShieldIcon,
  globe: GlobeIcon,
  clock: ClockIcon,
  sparkle: SparkleIcon,
  chart: ChartIcon,
  cpu: CpuIcon,
  mail: MailIcon,
  briefcase: BriefcaseIcon,
  building: BuildingIcon,
  dumbbell: DumbbellIcon,
  graduation: GraduationCapIcon,
  utensils: UtensilsIcon,
  bag: ShoppingBagIcon,
};

export const ICON_CHOICE_OPTIONS: SelectOption[] = [
  { value: 'star', label: 'Звезда' },
  { value: 'heart', label: 'Сердце' },
  { value: 'check', label: 'Галочка' },
  { value: 'shield', label: 'Щит' },
  { value: 'globe', label: 'Глобус' },
  { value: 'clock', label: 'Часы' },
  { value: 'sparkle', label: 'Искра' },
  { value: 'chart', label: 'График' },
  { value: 'cpu', label: 'Технологии' },
  { value: 'mail', label: 'Письмо' },
  { value: 'briefcase', label: 'Портфель' },
  { value: 'building', label: 'Здание' },
  { value: 'dumbbell', label: 'Гантель' },
  { value: 'graduation', label: 'Образование' },
  { value: 'utensils', label: 'Еда' },
  { value: 'bag', label: 'Покупки' },
];

export function resolveIconChoice(key: string | undefined): ComponentType<IconProps> {
  return (key && ICON_CHOICES[key]) || StarIcon;
}

import type { ComponentType } from 'react';
import {
  BedIcon,
  BriefcaseIcon,
  BuildingIcon,
  CpuIcon,
  DumbbellIcon,
  GraduationCapIcon,
  HeartIcon,
  type IconProps,
  ShoppingBagIcon,
  SparkleIcon,
  UtensilsIcon,
} from '@/shared/ui/icons';
import type { BusinessCategory } from '../model/types';

export interface BusinessCategoryConfig {
  id: BusinessCategory;
  label: string;
  icon: ComponentType<IconProps>;
}

/** Порядок — он же порядок в выпадающем списке формы бизнеса, самые частые
 * категории первыми. `other` — всегда последний, это осознанный fallback,
 * не «ещё одна категория» наравне с прочими. */
export const BUSINESS_CATEGORIES: BusinessCategoryConfig[] = [
  { id: 'restaurant', label: 'Кафе и рестораны', icon: UtensilsIcon },
  { id: 'retail', label: 'Магазин', icon: ShoppingBagIcon },
  { id: 'services', label: 'Услуги', icon: BriefcaseIcon },
  { id: 'health', label: 'Здоровье', icon: HeartIcon },
  { id: 'beauty', label: 'Красота', icon: SparkleIcon },
  { id: 'fitness', label: 'Фитнес и спорт', icon: DumbbellIcon },
  { id: 'education', label: 'Образование', icon: GraduationCapIcon },
  { id: 'technology', label: 'Технологии', icon: CpuIcon },
  { id: 'creative', label: 'Творчество и дизайн', icon: SparkleIcon },
  { id: 'real_estate', label: 'Недвижимость', icon: BuildingIcon },
  { id: 'hospitality', label: 'Отели и гостеприимство', icon: BedIcon },
  { id: 'nonprofit', label: 'Некоммерческая организация', icon: HeartIcon },
  { id: 'other', label: 'Другое', icon: BriefcaseIcon },
];

const BY_ID = new Map(BUSINESS_CATEGORIES.map((category) => [category.id, category]));

export function getBusinessCategoryConfig(id: BusinessCategory): BusinessCategoryConfig {
  return BY_ID.get(id) ?? BUSINESS_CATEGORIES[BUSINESS_CATEGORIES.length - 1];
}

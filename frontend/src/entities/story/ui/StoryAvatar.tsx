import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Avatar, type AvatarSize } from '@/shared/ui/Avatar';
import type { StoryGroup } from '../model/types';
import styles from './StoryAvatar.module.scss';

export interface StoryAvatarProps {
  /** `null` — группы ещё нет вообще (лента историй не загрузилась), пустой
   * `stories: []` — группа есть, историй нет (свой профиль без активной
   * истории, ещё может показывать «+» через `addTrigger`). */
  group: StoryGroup | null;
  size?: AvatarSize;
  /** Клик по самой аватарке — открыть просмотр; компонент не владеет
   * состоянием просмотрщика, только сообщает о клике (см. `widgets/stories`,
   * который решает, что показать). Игнорируется, если у группы нет ни одной
   * истории — открывать нечего. */
  onClick?: () => void;
  /** Готовый триггер добавления истории (обычно `ImageUploadButton` из
   * `features/upload-image`, спозиционированный вызывающим виджетом как
   * бейдж в углу) — не встроенная кнопка внутри этого компонента: `entities`
   * не может импортировать `features` (см. AGENTS.md §3, граница слоёв), а
   * `ImageUploadButton` сам рендерит `<button>`, вложить его в кольцевую
   * кнопку ниже всё равно было бы невалидным HTML. */
  addTrigger?: ReactNode;
  className?: string;
}

/**
 * Обёртка вокруг `shared/ui/Avatar` с кольцом истории — переиспользуется и в
 * ленте историй (`widgets/stories/ui/StoriesTray`), и на своей/чужой
 * странице профиля (`widgets/profile`). Кольцо — толщина не зависит от
 * размера аватарки (`padding`, не фиксированная ширина), поэтому один и тот
 * же компонент одинаково работает для `sm`/`md` (лента) и `xl` (профиль).
 */
export function StoryAvatar({
  group,
  size = 'md',
  onClick,
  addTrigger,
  className,
}: StoryAvatarProps) {
  const hasStories = Boolean(group && group.stories.length > 0);
  const ringState = !hasStories ? 'none' : group?.hasUnseen ? 'unseen' : 'seen';

  const handleAvatarClick = () => {
    if (hasStories) onClick?.();
  };

  return (
    <span className={cn(styles['story-avatar'], className)}>
      <button
        type="button"
        className={cn(styles['story-avatar__ring'], styles[`story-avatar__ring--${ringState}`])}
        onClick={handleAvatarClick}
        disabled={!hasStories}
        aria-label={group ? `Истории ${group.author.name}` : 'Истории'}
      >
        <Avatar
          initials={group?.author.initials ?? ''}
          src={group?.author.avatarUrl}
          size={size}
          // Рамка нужна только чтобы отделить аватарку от цветной заливки
          // кольца (`--seen`/`--unseen`) — без историй кольца нет вообще
          // (см. `--none` в module.scss), и та же рамка сама по себе
          // выглядела бы как остаточное кольцо, путая ровно с тем, что
          // должен был убрать этот компонент.
          bordered={hasStories}
        />
      </button>
      {addTrigger}
    </span>
  );
}

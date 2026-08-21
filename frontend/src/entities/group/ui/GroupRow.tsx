import type { ReactNode } from 'react';
import { pluralizeRu } from '@/shared/lib/pluralize-ru';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import type { Group } from '../model/types';
import styles from './GroupRow.module.scss';

export interface GroupRowProps {
  group: Group;
  onOpen: (groupId: string) => void;
  /** Кнопка вступления/выхода/статуса заявки — feature-уровня
   * (`features/group-membership`), `entities/group` не может её
   * импортировать (направление зависимостей FSD), поэтому вызывающий widget
   * передаёт готовый узел. */
  actions?: ReactNode;
}

export function GroupRow({ group, onOpen, actions }: GroupRowProps) {
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles['group__avatar-trigger']}
        onClick={() => onOpen(group.id)}
      >
        <Avatar initials={group.name.slice(0, 2).toUpperCase()} src={group.avatarUrl} />
      </button>
      <div className={styles.group__body}>
        <button
          type="button"
          className={styles['group__name-trigger']}
          onClick={() => onOpen(group.id)}
        >
          <span className={styles.group__name}>{group.name}</span>
        </button>
        <span className={styles['group__meta']}>
          {group.membersCount}{' '}
          {pluralizeRu(group.membersCount, ['участник', 'участника', 'участников'])}
        </span>
      </div>
      <Badge variant="soft">{group.type === 'open' ? 'Открытая' : 'Приватная'}</Badge>
      {actions}
      <Button variant="outline" onClick={() => onOpen(group.id)}>
        Открыть
      </Button>
    </div>
  );
}

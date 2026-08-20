import { Button } from '@/shared/ui/Button';
import type { Group } from '../model/types';
import styles from './GroupRow.module.scss';

export interface GroupRowProps {
  group: Group;
}

export function GroupRow({ group }: GroupRowProps) {
  return (
    <div className={styles.group}>
      <span className={styles.group__mark}>{group.mark}</span>
      <div className={styles.group__body}>
        <span className={styles.group__name}>{group.name}</span>
        <span className={styles['group__meta']}>{group.meta}</span>
      </div>
      <span className={styles.group__role}>{group.role}</span>
      <Button variant="outline">Открыть</Button>
    </div>
  );
}

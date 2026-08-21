'use client';

import { useState } from 'react';
import { usePostStore } from '@/entities/post';
import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { PostEditor } from './PostEditor';
import styles from './PostComposer.module.scss';

export interface PostComposerProps {
  /** `feed` — многострочный композер с чипами, `wall`/`group` — однострочная
   * запись (на стене или в группе). Все варианты сворачиваются в этот же
   * лаконичный вид по умолчанию — полноценный редактор (`PostEditor`)
   * разворачивается только по клику, см. `isExpanded` ниже. Это и есть
   * переиспользование одного редактора для разных контекстов публикации
   * (лента/стена/группа) — параметром вызова, без отдельных компонентов
   * редактора под каждый контекст. */
  variant?: 'feed' | 'wall' | 'group';
  /** Чья стена — если не задано, публикация идёт на свою собственную (см.
   * `entities/post`, `publishPost`). Задаётся на `UserProfileView`, когда
   * пишешь на стене другого пользователя. Взаимоисключающе с `groupId`. */
  wallOwnerId?: string;
  /** Публикация в группе вместо стены — обязателен при `variant="group"`
   * (см. `widgets/groups/ui/GroupPageView`). */
  groupId?: string;
}

/**
 * Публикация поста нужна и в ленте, и на стене профиля (своей и чужой), и в
 * группе — один feature-компонент с тремя визуальными вариантами вместо
 * дублирования логики черновика/сабмита. По умолчанию свёрнут (тот же
 * лаконичный вид, что был у контрола до появления полноценного редактора) —
 * сам инпут выступает тогглом: клик по нему (или по любому чипу/кнопке)
 * разворачивает `PostEditor`. После успешной публикации композер
 * сворачивается обратно.
 */
export function PostComposer({ variant = 'feed', wallOwnerId, groupId }: PostComposerProps) {
  const { currentUser } = useCurrentUser();
  const publishPost = usePostStore((state) => state.publishPost);
  const [isExpanded, setExpanded] = useState(false);
  const isOwnWall = !wallOwnerId || wallOwnerId === currentUser.id;

  const submitPost = async ({ text, images }: { text: string; images: File[] }) => {
    await publishPost({ text, images, wallOwnerId, groupId });
    setExpanded(false);
  };

  if (isExpanded) {
    return (
      <Card className={styles.composer}>
        <div className={styles.composer__top}>
          <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} />
          <div className={styles['composer__editor']}>
            <PostEditor
              mode="create"
              placeholder={
                variant === 'group'
                  ? 'Написать в группе…'
                  : variant === 'wall'
                    ? isOwnWall
                      ? 'Записать на своей стене…'
                      : 'Написать на этой стене…'
                    : 'О чём расскажешь залу?'
              }
              submitLabel={variant === 'feed' ? 'Рассказать' : 'Записать'}
              pendingLabel={variant === 'feed' ? 'Публикуем…' : 'Записываем…'}
              onSubmit={submitPost}
              onCancel={() => setExpanded(false)}
            />
          </div>
        </div>
      </Card>
    );
  }

  if (variant === 'wall' || variant === 'group') {
    return (
      <Card className={cn(styles.composer, styles['composer--wall'])}>
        <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} />
        <button
          type="button"
          className={styles['composer__input-toggle']}
          onClick={() => setExpanded(true)}
        >
          {variant === 'group'
            ? 'Написать в группе…'
            : isOwnWall
              ? 'Записать на своей стене…'
              : 'Написать на этой стене…'}
        </button>
        <Button onClick={() => setExpanded(true)}>Записать</Button>
      </Card>
    );
  }

  return (
    <Card className={styles.composer}>
      <div className={styles.composer__top}>
        <Avatar initials={currentUser.initials} src={currentUser.avatarUrl} />
        <button
          type="button"
          className={styles['composer__textarea-toggle']}
          onClick={() => setExpanded(true)}
        >
          О чём расскажешь залу?
        </button>
      </div>
      <div className={styles.composer__actions}>
        <Button variant="chip" onClick={() => setExpanded(true)}>
          Фото
        </Button>
        <Button variant="chip" onClick={() => setExpanded(true)}>
          Сбор
        </Button>
        <Button variant="chip" onClick={() => setExpanded(true)}>
          Опрос
        </Button>
        <Button className={styles['composer__submit']} onClick={() => setExpanded(true)}>
          Рассказать
        </Button>
      </div>
    </Card>
  );
}

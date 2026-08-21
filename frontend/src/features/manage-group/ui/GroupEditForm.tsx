'use client';

import { useState } from 'react';
import { useGroupStore, type Group, type GroupType } from '@/entities/group';
import { ImageUploadButton } from '@/features/upload-image';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { MediaPlaceholder } from '@/shared/ui/MediaPlaceholder';
import styles from './GroupEditForm.module.scss';

export interface GroupEditFormProps {
  /** `create` — только текстовые поля (аватар/обложка недоступны до создания
   * — загрузке нужен реальный `groupId`, см. `entities/group/api/
   * upload-group-image.ts`), `edit` — те же поля + изображения; `group`
   * обязателен для `edit` (владелец-only на backend, контролируется тем, что
   * вызывающий widget показывает эту форму только владельцу). Один
   * компонент вместо двух форм, как и `PostEditor` с `mode`. */
  mode: 'create' | 'edit';
  group?: Group;
  /** Вызывается и после сохранения (с итоговой группой), и после отмены
   * (без аргумента) — выходит из режима редактирования/создания. */
  onDone: (group?: Group) => void;
}

export function GroupEditForm({ mode, group, onDone }: GroupEditFormProps) {
  const createGroup = useGroupStore((state) => state.createGroup);
  const updateGroup = useGroupStore((state) => state.updateGroup);
  const uploadGroupAvatar = useGroupStore((state) => state.uploadGroupAvatar);
  const uploadGroupCover = useGroupStore((state) => state.uploadGroupCover);
  // Живые данные группы — после загрузки аватара/обложки store обновляется,
  // а `group`-проп остаётся снэпшотом на момент открытия формы.
  const liveGroup =
    useGroupStore((state) => (group ? state.groupsById[group.id] : undefined)) ?? group;
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [type, setType] = useState<GroupType>(group?.type ?? 'open');
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const save = async () => {
    if (isPending || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const trimmedInput = { name: name.trim(), description: description.trim(), type };
      if (mode === 'edit') {
        if (!group) throw new Error('Группа для редактирования не передана');
        onDone(await updateGroup(group.id, trimmedInput));
      } else {
        onDone(await createGroup(trimmedInput));
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить группу');
    } finally {
      setPending(false);
    }
  };

  const uploadImage = async (kind: 'avatar' | 'cover', file: Blob) => {
    if (!liveGroup) return;
    setImageError(null);
    try {
      await (kind === 'avatar'
        ? uploadGroupAvatar(liveGroup.id, file)
        : uploadGroupCover(liveGroup.id, file));
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error ? uploadError.message : 'Не удалось загрузить изображение',
      );
    }
  };

  return (
    <Card className={styles.form}>
      <h2 className={styles['form__title']}>
        {mode === 'create' ? 'Новая группа' : 'Правка группы'}
      </h2>

      {mode === 'edit' && liveGroup && (
        <div className={styles['form__images']}>
          <div className={styles['form__cover-preview']}>
            {liveGroup.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- превью локально обрезанного изображения, не оптимизируемый Next Image-контент
              <img src={liveGroup.coverUrl} alt="" className={styles['form__cover-image']} />
            ) : (
              <MediaPlaceholder label="обложка группы · 1600×400" height="100%" flush />
            )}
            <ImageUploadButton
              aspect={3}
              shape="rect"
              upload={(file) => uploadImage('cover', file)}
              className={styles['form__cover-trigger']}
            >
              Сменить обложку
            </ImageUploadButton>
          </div>

          <div className={styles['form__avatar-row']}>
            <Avatar
              initials={liveGroup.name.slice(0, 2).toUpperCase()}
              src={liveGroup.avatarUrl}
              size="xl"
              bordered
            />
            <ImageUploadButton
              aspect={1}
              shape="round"
              upload={(file) => uploadImage('avatar', file)}
              className={styles['form__avatar-trigger']}
            >
              Сменить аватар
            </ImageUploadButton>
          </div>
          {imageError && <p className={styles['form__error']}>{imageError}</p>}
        </div>
      )}

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>Название</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
      </label>

      <label className={styles['form__field']}>
        <span className={styles['form__field-label']}>Описание</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          rows={3}
        />
      </label>

      <div className={styles['form__field']}>
        <span className={styles['form__field-label']}>Тип группы</span>
        <div className={styles['form__type-toggle']}>
          <button
            type="button"
            className={cn(
              styles['form__type-option'],
              type === 'open' && styles['form__type-option--active'],
            )}
            onClick={() => setType('open')}
          >
            Открытая — вступить может любой
          </button>
          <button
            type="button"
            className={cn(
              styles['form__type-option'],
              type === 'private' && styles['form__type-option--active'],
            )}
            onClick={() => setType('private')}
          >
            Приватная — только по заявке
          </button>
        </div>
      </div>

      {error && <p className={styles['form__error']}>{error}</p>}

      <div className={styles['form__actions']}>
        <Button variant="outline" onClick={() => onDone()} disabled={isPending}>
          Отмена
        </Button>
        <Button onClick={() => void save()} disabled={isPending || !name.trim()}>
          {isPending ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </Card>
  );
}

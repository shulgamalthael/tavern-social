'use client';

import { useEffect, useState } from 'react';
import { getStoryViewers, StoryAvatar, useStoryStore } from '@/entities/story';
import { useCurrentUser } from '@/entities/user';
import { useNavigationStore } from '@/features/section-navigation';
import { ImageUploadButton } from '@/features/upload-image';
import { PlusIcon } from '@/shared/ui/icons';
import { StoryViewer } from './StoryViewer';
import styles from './StoriesTray.module.scss';

/**
 * Горизонтальная лента историй в новостях — своя аватарка с «+» первой
 * (даже без активной истории — пустая группа, гарантированная backend'ом,
 * см. `StoriesService.getTray`), дальше друзья/подписки с активными
 * историями. Клик по любой чужой аватарке открывает `StoryViewer` со всем
 * списком групп и стартовым индексом — переход от одного автора к другому
 * при исчерпании историй идёт уже внутри `StoryViewer`, не здесь.
 */
export function StoriesTray() {
  const { currentUser } = useCurrentUser();
  const tray = useStoryStore((state) => state.tray);
  const status = useStoryStore((state) => state.status);
  const loadTray = useStoryStore((state) => state.loadTray);
  const addStory = useStoryStore((state) => state.addStory);
  const markViewed = useStoryStore((state) => state.markViewed);
  const removeStory = useStoryStore((state) => state.removeStory);
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    loadTray();
  }, [loadTray]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className={styles.tray}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles['tray__skeleton']} />
        ))}
      </div>
    );
  }

  if (status === 'error' || tray.length === 0) return null;

  const [own, ...others] = tray;

  return (
    <div className={styles.tray}>
      <div className={styles['tray__item']}>
        <StoryAvatar
          group={own}
          size="md"
          onClick={() => setActiveIndex(0)}
          addTrigger={
            <ImageUploadButton
              aspect={9 / 16}
              upload={(file) => addStory(file)}
              className={styles['tray__add-trigger']}
            >
              <PlusIcon className={styles['tray__add-icon']} />
            </ImageUploadButton>
          }
        />
        <span className={styles['tray__label']}>Моя история</span>
      </div>

      {others.map((group, index) => (
        <div key={group.author.id} className={styles['tray__item']}>
          <StoryAvatar group={group} size="md" onClick={() => setActiveIndex(index + 1)} />
          <span className={styles['tray__label']}>{group.author.name}</span>
        </div>
      ))}

      {activeIndex !== null && (
        <StoryViewer
          groups={tray}
          startGroupIndex={activeIndex}
          currentUserId={currentUser.id}
          onClose={() => setActiveIndex(null)}
          onAuthorClick={(userId) => {
            setActiveIndex(null);
            goToUserProfile(userId);
          }}
          onStoryViewed={markViewed}
          onStoryDeleted={(storyId) => void removeStory(storyId)}
          onLoadViewers={getStoryViewers}
        />
      )}
    </div>
  );
}

import type { PublicProfile } from '@/modules/users/users.types';

export interface StoryDto {
  id: string;
  imageUrl: string;
  createdAt: string;
  /** Отдельно от `isViewedByMe` — своя история не отмечается просмотренной
   * (`StoriesService.markViewed` никогда не зовётся для своих), но фронту
   * нужно явно знать «это я», а не выводить это из сравнения id на клиенте. */
  isMine: boolean;
  isViewedByMe: boolean;
}

export interface StoryGroupDto {
  author: PublicProfile;
  stories: StoryDto[];
  /** true, если хотя бы одна история группы не просмотрена зрителем — для
   * своей группы всегда false (см. `isMine` выше). */
  hasUnseen: boolean;
}

export interface StoryViewerEntryDto {
  viewer: PublicProfile;
  viewedAt: string;
}

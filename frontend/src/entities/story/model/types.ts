export interface StoryAuthor {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export interface Story {
  id: string;
  imageUrl: string;
  createdAt: string;
  isMine: boolean;
  isViewedByMe: boolean;
}

export interface StoryGroup {
  author: StoryAuthor;
  stories: Story[];
  hasUnseen: boolean;
}

export interface StoryViewerEntry {
  viewer: StoryAuthor;
  viewedAt: string;
}

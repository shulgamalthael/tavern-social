import type { FeedKind } from '@/entities/post';

export const FEED_TABS = ['Всё', 'Друзья', 'Сообщества', 'Сборы'] as const;

export type FeedTab = (typeof FEED_TABS)[number];

export const FEED_TAB_KIND: Record<FeedTab, FeedKind | undefined> = {
  Всё: undefined,
  Друзья: 'friends',
  Сообщества: 'communities',
  Сборы: 'events',
};

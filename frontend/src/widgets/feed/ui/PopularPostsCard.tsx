import { useMemo } from 'react';
import type { Post } from '@/entities/post';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import styles from './PopularPostsCard.module.scss';

const POPULAR_POSTS_LIMIT = 4;
const SNIPPET_MAX_LENGTH = 72;

function toSnippet(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > SNIPPET_MAX_LENGTH ? `${text.slice(0, SNIPPET_MAX_LENGTH).trim()}…` : text;
}

function popularityScore(post: Post): number {
  return post.likes + post.comments * 2 + post.reposts * 3;
}

export interface PopularPostsCardProps {
  posts: Post[];
  onAuthorClick: (userId: string) => void;
}

/**
 * «Разные новости на сайте» из задачи редизайна ленты — честно составлены
 * из уже загруженных постов (`entities/post`), не отдельной сущности блога,
 * которой в проекте нет: ранжируем по реальному вовлечению
 * (`popularityScore`), а не подставляем что-то придуманное. Репосты
 * (`post.repostOf`) пропускаем — их собственный текст всегда пуст (см.
 * `entities/post/model/types.ts`), сниппет показывать нечего.
 */
export function PopularPostsCard({ posts, onAuthorClick }: PopularPostsCardProps) {
  const topPosts = useMemo(() => {
    return posts
      .filter((post) => !post.repostOf && popularityScore(post) > 0)
      .sort((a, b) => popularityScore(b) - popularityScore(a))
      .slice(0, POPULAR_POSTS_LIMIT);
  }, [posts]);

  return (
    <Card>
      <h2 className={styles['popular__title']}>Обсуждают в зале</h2>
      {topPosts.length === 0 ? (
        <EmptyState
          title="Пока тихо"
          description="Здесь появятся записи, которые набрали больше всего откликов."
        />
      ) : (
        <ul className={styles['popular__list']}>
          {topPosts.map((post) => (
            <li key={post.id} className={styles['popular__item']}>
              <button
                type="button"
                className={styles['popular__author']}
                onClick={() => onAuthorClick(post.authorId)}
              >
                <Avatar initials={post.initials} src={post.authorAvatarUrl} size="sm" />
                <span className={styles['popular__author-name']}>{post.author}</span>
              </button>
              <p className={styles['popular__snippet']}>
                {toSnippet(post.text) || (post.images.length > 0 ? 'Публикация с фото' : '')}
              </p>
              <span className={styles['popular__meta']}>
                {post.likes} лайков · {post.comments} ответов
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

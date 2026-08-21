import type { Post } from '../model/types';

/**
 * Кнопка «Удалить» доступна только для собственной записи — не для чужой
 * (проверка авторства, как на backend, см. PostsService.remove). Фото
 * галереи тоже удаляемо отсюда: `PostsService.remove` заодно чистит
 * связанную `GalleryImage` и файл на диске, тем же способом, что и удаление
 * со страницы галереи — см. вызывающий код в `widgets/profile`, который
 * дополнительно обновляет соседнюю карточку галереи (та же фотография
 * иначе осталась бы там битой плиткой). Карточка репоста тоже удаляема —
 * но технически это отмена репоста (`toggleRepost`, а не `removePost`), у
 * неё свой отдельный счётчик `repostsCount` на оригинале, который нужно
 * декрементировать; см. вызывающий код в `widgets/feed`/`widgets/profile`,
 * где выбирается, какое действие вызвать.
 */
export function canDeletePost(post: Post, currentUserId: string): boolean {
  return post.authorId === currentUserId;
}

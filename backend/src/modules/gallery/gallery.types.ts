import type { PostDto } from '@/modules/posts/posts.types';

export interface GalleryImageDto {
  id: string;
  url: string;
  /** Id автосозданной записи (Post) для этого фото — почти всегда заполнен;
   * `null` только у изображений, загруженных до появления этой связи. Лайки/
   * дизлайки/комментарии к фото — это лайки/дизлайки/комментарии к этому
   * посту (см. `POST/DELETE /posts/:id/likes` и т. д.), отдельного API для
   * реакций на галерею нет. */
  postId: string | null;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  createdAt: string;
}

/** Ответ загрузки фото — вместе со строкой галереи отдаёт и весь Post,
 * который она автосоздала, чтобы frontend мог сразу дописать его в ленту/
 * стену без отдельного запроса (см. GalleryService.add). */
export interface GalleryUploadResultDto {
  image: GalleryImageDto;
  post: PostDto;
}

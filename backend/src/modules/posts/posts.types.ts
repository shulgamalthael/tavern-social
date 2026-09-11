import type { PostKind } from '@prisma/client';
import type { PublicProfile } from '@/modules/users/users.types';

/** Превью внешней ссылки, найденной в `text` поста — см. LinkPreviewService.
 * Только для ссылок, для которых удалось получить метаданные (`status ===
 * 'ok'`) — недоступная ссылка просто не попадает в этот массив, но остаётся
 * кликабельной внутри самого `text`. */
export interface LinkPreviewDto {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string | null;
}

/**
 * Сводка оригинального поста внутри репоста. Достаточно полная, чтобы
 * frontend не делал второй запрос за состоянием оригинала (лайкнут ли он
 * мной, сколько у него реакций) — все действия над репостом в ленте
 * (лайк/ответ/повторный репост) применяются именно к оригиналу, см.
 * AGENTS.md, раздел про репосты.
 */
export interface PostSummaryDto {
  id: string;
  author: PublicProfile;
  /// Чья это стена — см. PostDto.wallOwnerId. `null`, если пост из группы.
  wallOwnerId: string | null;
  wallOwnerName: string | null;
  /// Пост опубликован в группе — см. PostDto.groupId.
  groupId: string | null;
  groupName: string | null;
  /** Санитизированный HTML — см. PostDto.text. */
  text: string;
  /** URL картинок, встреченных в `text`, в порядке появления — только для
   * `ImageLightbox` на frontend (клик по инлайн-картинке открывает лайтбокс
   * с полным списком). Не самостоятельное представление контента, см.
   * PostDto.images. */
  images: string[];
  linkPreviews: LinkPreviewDto[];
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  isRepostedByMe: boolean;
}

/** Результат `PostsService.getShareSummary` — единая точка правды для
 * «может ли КОНКРЕТНЫЙ зритель сейчас видеть этот пост», используется и на
 * отправке (§103, отправитель не может поделиться тем, чего сам не видит),
 * и на каждом чтении уже отправленного сообщения с `sharedPostId` —
 * дискриминированный union, а не один объект с нулевыми полями, чтобы
 * frontend не мог случайно отрендерить `text`/`images` в недоступном
 * случае (их там физически нет в типе). `restricted` — сознательно НЕ то
 * же самое, что «404»: пост существует, просто приватный для этого зрителя
 * — верхний блок автора (см. `PublicProfile`) всё равно показываем, он
 * публичен всегда (§103), в отличие от текста/картинок/стены. `not_found`
 * — защитный случай (пост реально удалён/гонка) — обычной пересылкой
 * практически недостижим благодаря `onDelete: SetNull` у
 * `Message.sharedPostId`. */
export type SharedPostDto =
  | { status: 'visible'; post: PostSummaryDto }
  | { status: 'restricted'; author: PublicProfile }
  | { status: 'not_found' };

export interface PostDto {
  id: string;
  author: PublicProfile;
  /** Чья это стена — обычно совпадает с author.id, но может отличаться,
   * если пост написан на чужой стене (см. PostsService.create). `null`,
   * если пост опубликован в группе (см. groupId) — ровно одно из двух полей
   * заполнено, никогда оба сразу. */
  wallOwnerId: string | null;
  wallOwnerName: string | null;
  /** Пост опубликован в группе — альтернатива wallOwnerId, см. выше. */
  groupId: string | null;
  groupName: string | null;
  kind: PostKind;
  /** Санитизированный HTML (см. common/lib/sanitize-post-content.ts) —
   * единственный источник и текста, и позиции картинок: `<img>` внутри уже
   * стоит там, куда его вставили в редакторе. */
  text: string;
  /** URL картинок, встреченных в `text`, в порядке появления — см.
   * PostSummaryDto.images. */
  images: string[];
  linkPreviews: LinkPreviewDto[];
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  viewsCount: number;
  repostsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  isRepostedByMe: boolean;
  /** Продвижение (AI_PLATFORM_ROADMAP.md §73) — `true`, пока у поста есть
   * оплаченное продвижение с `endsAt` в будущем. Это же поле — единственная
   * причина, по которой пост может оказаться в ленте у того, кто не друг
   * автору и не состоит в его сообществе (см. `PostsService.listFeed`). */
  isPromoted: boolean;
  /** `null`, если `isPromoted: false`. */
  promotedUntil: string | null;
  createdAt: string;
  repostOf: PostSummaryDto | null;
}

export interface CommentDto {
  id: string;
  postId: string;
  /** null — комментарий верхнего уровня; иначе — id комментария верхнего
   * уровня, на который отвечают (один уровень вложенности, см. AGENTS.md). */
  parentId: string | null;
  author: PublicProfile;
  text: string;
  createdAt: string;
}

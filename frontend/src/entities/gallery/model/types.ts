export interface GalleryImage {
  id: string;
  url: string;
  /** Id автосозданной записи (Post) для этого фото — почти всегда заполнен;
   * `null` только у изображений, загруженных до появления этой связи. Лайки/
   * дизлайки/комментарии к фото — это лайки/дизлайки/комментарии к этому
   * посту, через обычные `entities/post` API (`togglePostLike` и т. д.),
   * отдельного API для реакций на галерею нет — см. `widgets/profile/ui/GalleryLightbox`. */
  postId: string | null;
  likes: number;
  dislikes: number;
  comments: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  createdAt: string;
}

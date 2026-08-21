import type { GalleryImage } from '../model/types';

export interface GalleryImageResponse {
  id: string;
  url: string;
  postId: string | null;
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isDislikedByMe: boolean;
  createdAt: string;
}

export function mapGalleryImage(image: GalleryImageResponse): GalleryImage {
  return {
    id: image.id,
    url: image.url,
    postId: image.postId,
    likes: image.likesCount,
    dislikes: image.dislikesCount,
    comments: image.commentsCount,
    isLikedByMe: image.isLikedByMe,
    isDislikedByMe: image.isDislikedByMe,
    createdAt: image.createdAt,
  };
}

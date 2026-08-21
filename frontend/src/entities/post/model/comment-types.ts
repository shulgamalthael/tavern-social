export interface Comment {
  id: string;
  postId: string;
  /** null — комментарий верхнего уровня; иначе — id комментария верхнего
   * уровня, на который отвечают (один уровень вложенности). */
  parentId: string | null;
  authorId: string;
  author: string;
  initials: string;
  avatarUrl: string | null;
  meta: string;
  text: string;
}

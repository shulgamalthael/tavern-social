export interface Comment {
  id: string;
  postId: string;
  /** null — комментарий верхнего уровня; иначе — id комментария верхнего
   * уровня, на который отвечают (один уровень вложенности). */
  parentId: string | null;
  author: string;
  initials: string;
  meta: string;
  text: string;
}

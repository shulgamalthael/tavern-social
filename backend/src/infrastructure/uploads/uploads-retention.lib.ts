/** Один файл на диске в `uploads/messages/`, уже переведённый в url-форму
 * (`/uploads/messages/<имя>`) и с временем последнего изменения. */
export interface UploadFileEntry {
  url: string;
  mtimeMs: number;
}

/**
 * Чистая функция — какие url'ы из `uploads/messages/` безопасно удалить:
 * старше `cutoffMs` И не встречаются в `referencedUrls` (реально
 * привязанные к отправленному сообщению, `MessageAttachment.url`). Не
 * трогает `fs`/Prisma сама — та же причина, что и у остальных `*.lib.ts` в
 * проекте (`ai-capacity.lib.ts` и т. п.): юнит-тестируема без моков
 * файловой системы или БД, реальный ввод-вывод — только в
 * `UploadsRetentionService`.
 */
export function selectOrphanedUploadUrls(
  files: readonly UploadFileEntry[],
  cutoffMs: number,
  referencedUrls: ReadonlySet<string>,
): string[] {
  return files
    .filter((file) => file.mtimeMs < cutoffMs && !referencedUrls.has(file.url))
    .map((file) => file.url);
}

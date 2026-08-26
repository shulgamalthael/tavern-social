/** Человекочитаемый размер файла — вложения чата (см. `MessageAttachment`),
 * не общего назначения (без ТБ и выше: потолок вложения — 5 МБ). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} КБ`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} МБ`;
}

/** Человекочитаемые названия инструментов — общие для `AiChatPanel` (баджи
 * под репликой ассистента) и `AiActivityFeed` (лента активности, AI-3).
 * Один источник, чтобы название инструмента не разъезжалось между двумя
 * местами показа одного и того же факта "AI выполнил X". */
const TOOL_LABELS: Record<string, string> = {
  get_project_tree: 'Прочитал структуру сайта',
  create_page: 'Создал страницу',
  add_block: 'Добавил блок',
  update_block_props: 'Изменил блок',
  set_style: 'Изменил оформление блока',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

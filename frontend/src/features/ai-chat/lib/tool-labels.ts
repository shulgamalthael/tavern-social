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
  list_media_assets: 'Посмотрел загруженные файлы',
  create_custom_widget: 'Сохранил виджет',
  get_wallet_info: 'Проверил кошелёк',
  list_entities: 'Посмотрел сущности',
  create_entity: 'Создал сущность',
  add_field: 'Добавил поле',
  publish_website: 'Опубликовал сайт',
};

export function toolLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}

/** Подпись уровня риска для карточки подтверждения (AI-9) — `low`/`medium`
 * сюда никогда не попадают (только `high`/`critical` останавливают ход,
 * см. `runToolLoop` на backend), но карта полная ради типовой полноты, не
 * из практической необходимости показывать первые два. */
const RISK_LEVEL_LABELS: Record<string, string> = {
  low: 'низкий риск',
  medium: 'средний риск',
  high: 'высокий риск',
  critical: 'критический риск',
};

export function riskLevelLabel(riskLevel: string): string {
  return RISK_LEVEL_LABELS[riskLevel] ?? riskLevel;
}

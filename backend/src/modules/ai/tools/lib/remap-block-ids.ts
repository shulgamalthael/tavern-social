import { randomUUID } from 'node:crypto';
import type { WebsiteBlock } from '@/modules/websites/websites.types';

/**
 * Backend-версия frontend `remapBlockIds` (`entities/website/model/
 * block-tree.ts`, используется `insertWidgetBlocks` там же) — тот же
 * самый приём и по той же причине: один и тот же сохранённый `CustomWidget`
 * может быть вставлен на страницу несколько раз (человеком через "Мои
 * виджеты" в билдере, или AI через `insert_custom_widget`), и каждая
 * вставка обязана породить блоки со свежими `id`, а не переиспользовать
 * `id`, под которым виджет хранится в БД — иначе два экземпляра одного
 * виджета на разных страницах (или на одной, дважды) схлопнулись бы в один
 * при последующем поиске/замене блока по id.
 *
 * Рекурсивна по `children` на тот же случай "будущего блока с вложенными
 * детьми", что и у frontend-версии — `CustomWidget.schema` сегодня всегда
 * плоский список без `children` (`parseWidgetSchema`, `custom-widgets.
 * types.ts`, не присваивает их), но функция не должна молча ломаться, если
 * это когда-нибудь изменится.
 */
export function remapBlockIds(block: WebsiteBlock): WebsiteBlock {
  const remapped: WebsiteBlock = { ...block, id: randomUUID() };
  if (block.children) {
    remapped.children = block.children.map(remapBlockIds);
  }
  return remapped;
}

import { Extension, Mark, mergeAttributes, Node } from '@tiptap/core';

/**
 * Инлайновый `style` не входит в стандартную схему Tiptap/StarterKit — без
 * этого расширения атрибут молча терялся бы при разборе вставленного/
 * введённого HTML (см. `PostEditor`, HTML-режим), даже если backend его
 * пропустит через санитайзер (`common/lib/sanitize-post-content.ts` — тот же
 * allowlist свойств). Применяется сразу к нескольким типам узлов/меток через
 * `addGlobalAttributes`, а не копированием `addAttributes` в каждом из них.
 */
export const InlineStyle = Extension.create({
  name: 'inlineStyle',
  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'div',
          'horizontalRule',
          'bulletList',
          'orderedList',
          'listItem',
          'bold',
          'span',
          'table',
          'tableHead',
          'tableBody',
          'tableFoot',
          'tableRow',
          'tableCell',
          'tableHeader',
        ],
        attributes: {
          style: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('style'),
            renderHTML: (attributes: { style?: string | null }) =>
              attributes.style ? { style: attributes.style } : {},
          },
        },
      },
    ];
  },
});

/** `<span style="...">` — бейджи статусов и любой другой инлайновый кусок
 * текста со своим оформлением внутри стилизованных карточек (см. `Div`
 * ниже). Марка, а не узел — тот же приём, что и стандартные `Bold`/`Italic`:
 * применяется к произвольному диапазону текста, а не оборачивает его в
 * отдельный блок. */
export const Span = Mark.create({
  name: 'span',
  parseHTML() {
    return [{ tag: 'span' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

/** Верно/неверно введённые `colspan`/`rowspan` — вход в задачу про таблицы
 * (см. `Table`/`TableCell`/`TableHeader` ниже): ячейка итоговой строки в
 * примере из задачи объединяет несколько колонок. Общая для `td`/`th`, а не
 * дублирование `addAttributes` в обоих. */
function addTableCellSpanAttributes() {
  return {
    colspan: {
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute('colspan'),
      renderHTML: (attributes: { colspan?: string | null }) =>
        attributes.colspan ? { colspan: attributes.colspan } : {},
    },
    rowspan: {
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute('rowspan'),
      renderHTML: (attributes: { rowspan?: string | null }) =>
        attributes.rowspan ? { rowspan: attributes.rowspan } : {},
    },
  };
}

/**
 * Таблица как самостоятельная разметка (не сетка `display: grid` на `div`) —
 * нужна для форматов вроде бухгалтерских журналов/прайс-листов, вставляемых
 * через HTML-режим редактора, где `<table>` — это подпись данных
 * (`<th>`/`colspan`), а не просто визуальный вид. Шесть узлов ниже —
 * структурный каркас (`table` → `thead`/`tbody`/`tfoot` → `tr` →
 * `th`/`td`), без интерактивного редактирования (нет кнопок «добавить
 * строку», resize колонок и т. п. — этого в задаче не просили, только
 * сохранить структуру вставленной разметки). Официальный
 * `@tiptap/extension-table` тут не подошёл: он всегда рендерит все строки в
 * один `<tbody>` (теряя `<thead>`/`<tfoot>`) и добавляет свой `<colgroup>` —
 * то есть не про сохранение структуры 1-в-1, а про интерактивный редактор
 * таблиц, который не запрашивали.
 */
export const Table = Node.create({
  name: 'table',
  group: 'block',
  // Секции (`thead`/`tbody`/`tfoot`) — обычный случай размеченных таблиц
  // вроде примера из задачи, но допускаем и строки без секций напрямую —
  // так простые таблицы без `<thead>`/`<tbody>` тоже не теряются при разборе.
  content: '(tableHead | tableBody | tableFoot | tableRow)+',
  isolating: true,
  addAttributes() {
    return {
      role: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('role'),
        renderHTML: (attributes: { role?: string | null }) =>
          attributes.role ? { role: attributes.role } : {},
      },
      cellpadding: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('cellpadding'),
        renderHTML: (attributes: { cellpadding?: string | null }) =>
          attributes.cellpadding ? { cellpadding: attributes.cellpadding } : {},
      },
      cellspacing: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('cellspacing'),
        renderHTML: (attributes: { cellspacing?: string | null }) =>
          attributes.cellspacing ? { cellspacing: attributes.cellspacing } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'table' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableHead = Node.create({
  name: 'tableHead',
  content: 'tableRow+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'thead' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['thead', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableBody = Node.create({
  name: 'tableBody',
  content: 'tableRow+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'tbody' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['tbody', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableFoot = Node.create({
  name: 'tableFoot',
  content: 'tableRow+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'tfoot' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['tfoot', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableRow = Node.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)+',
  parseHTML() {
    return [{ tag: 'tr' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableCell = Node.create({
  name: 'tableCell',
  content: 'inline*',
  addAttributes: addTableCellSpanAttributes,
  parseHTML() {
    return [{ tag: 'td' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableHeader = Node.create({
  name: 'tableHeader',
  content: 'inline*',
  addAttributes: addTableCellSpanAttributes,
  parseHTML() {
    return [{ tag: 'th' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0];
  },
});

/** StarterKit не включает `<div>` — без него обёртки вида `<div
 * style="...">...</div>` (стилизованные карточки, см. задачу про рендер
 * HTML со стилями) молча разворачивались бы в голые дочерние блоки при
 * разборе HTML в HTML-режиме редактора. `content: 'block*'` — div может
 * содержать другие блоки, включая вложенные div (карточки внутри карточки). */
export const Div = Node.create({
  name: 'div',
  group: 'block',
  content: 'block*',
  parseHTML() {
    return [{ tag: 'div' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0];
  },
});

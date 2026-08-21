import { Extension, mergeAttributes, Node } from '@tiptap/core';

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

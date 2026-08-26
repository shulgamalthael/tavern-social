'use client';

import { ScrollArea } from '@/shared/ui/ScrollArea';
import styles from './EmojiPicker.module.scss';

/** Куратированный статический список — без внешней зависимости на
 * emoji-датасет (проект и так собирает мало зависимостей, см. AGENTS.md
 * §1). Категории — общие для любого чата плюс пара «в духе Таверны». */
const EMOJI_CATEGORIES: { label: string; emoji: string[] }[] = [
  {
    label: 'Смайлы',
    emoji: [
      '😀',
      '😄',
      '😁',
      '😆',
      '😅',
      '🤣',
      '😂',
      '🙂',
      '😉',
      '😊',
      '😍',
      '😘',
      '😜',
      '🤔',
      '😏',
      '😴',
      '😭',
      '😡',
      '🥳',
      '😎',
    ],
  },
  {
    label: 'Жесты',
    emoji: ['👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '✌️', '🤞', '👋', '🤙', '👌'],
  },
  {
    label: 'Таверна',
    emoji: ['🍺', '🍻', '🥃', '🍷', '🍕', '🔥', '🎉', '🎲', '🃏', '🗡️', '🛡️', '🏰'],
  },
  {
    label: 'Звери',
    emoji: ['🐶', '🐱', '🦊', '🐻', '🐼', '🦁', '🐸', '🐔', '🐴', '🐺'],
  },
  {
    label: 'Символы',
    emoji: ['❤️', '⭐', '✨', '💯', '☀️', '🌙', '⚡', '🍀', '💤', '❗'],
  },
];

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

/** Попап выбора эмодзи над композером — сам не отслеживает клик снаружи,
 * этим управляет вызывающий компонент (`MessageComposer`), оборачивая
 * кнопку-тумблер и попап в один контейнер с общим `ref` — тот же паттерн,
 * что и у `AddParticipantDropdown`/`MessengerWidget`. */
export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className={styles.picker} role="dialog" aria-label="Эмодзи">
      <ScrollArea
        className={styles['picker__scroll']}
        viewportClassName={styles['picker__viewport']}
      >
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.label} className={styles['picker__category']}>
            <span className={styles['picker__category-label']}>{category.label}</span>
            <div className={styles['picker__grid']}>
              {category.emoji.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles['picker__emoji']}
                  onClick={() => onSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

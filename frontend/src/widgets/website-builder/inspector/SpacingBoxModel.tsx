import styles from './SpacingBoxModel.module.scss';

export interface SpacingBoxModelProps {
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

/**
 * Живая визуальная схема margin/padding/content конкретного блока —
 * ответ на явную критику брифа: «пользователь не должен видеть просто
 * набор непонятных input-полей», должен «визуально понимать, что он
 * редактирует» (AI_PLATFORM_ROADMAP.md §31/§33). Только для «Простого»
 * таба `LayoutSection.tsx` — там ровно те 4 поля (`paddingY`/`paddingX`/
 * `marginTop`/`marginBottom`), которые эта схема показывает, уже
 * редактируются контролами под ней; вкладка «Дополнительно» (независимые
 * стороны) в схему не встроена — у неё уже есть собственный список,
 * подписанный по сторонам напрямую.
 *
 * Сознательно read-only, не редактируемая прямо в схеме: значения только
 * ОТОБРАЖАЮТСЯ здесь, редактируются как раньше — через контролы `spacing`
 * ниже. Одна схема, редактируемая кликом по цифре, потребовала бы второй,
 * параллельной реализации того же select+число, что уже есть у `control:
 * 'spacing'` (`FieldControl.tsx`) — источник истины остаётся один, схема
 * только визуализирует его текущее состояние и обновляется реактивно при
 * любом изменении контролов под ней.
 *
 * Отступа слева/справа у `margin` в этой системе не существует (блоки
 * страницы всегда на всю ширину, `BlockStyle` не хранит `marginLeft`/
 * `marginRight`) — поэтому кольцо margin показывает только верх/низ, в
 * отличие от общей CSS-модели с четырёх сторон.
 */
export function SpacingBoxModel({
  marginTop,
  marginBottom,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
}: SpacingBoxModelProps) {
  return (
    <div className={styles.model} aria-hidden="true">
      <div className={styles.margin}>
        <span className={styles.margin__label}>Отступ до блока</span>
        <span className={styles['margin__value--top']}>{marginTop}px</span>

        <div className={styles.padding}>
          <span className={styles.padding__label}>Внутренние отступы</span>
          <span className={styles['padding__value--top']}>{paddingTop}px</span>
          <span className={styles['padding__value--right']}>{paddingRight}px</span>
          <span className={styles['padding__value--bottom']}>{paddingBottom}px</span>
          <span className={styles['padding__value--left']}>{paddingLeft}px</span>

          <div className={styles.content}>Контент</div>
        </div>

        <span className={styles['margin__value--bottom']}>{marginBottom}px</span>
      </div>
    </div>
  );
}

import { CodeIcon } from '@/shared/ui/icons';
import { registerBlock, type BlockRendererProps, type FieldSchema } from '../../model/registry';
import styles from './utility.module.scss';

// --- Embed -----------------------------------------------------------------
// Только URL для `<iframe>`, не произвольный вставленный HTML — вставка
// сырого HTML с backend без санитизации была бы хранимой XSS-дырой на
// публичной странице (см. корневой план фичи, раздел про безопасность
// упрощений). Ссылка на iframe того же типа риска не несёт — это ровно то,
// что уже безопасно поддерживают `video`/`location`-блоки.

interface EmbedProps {
  embedUrl: string;
  height: number;
  caption: string;
}

function EmbedRenderer({ props }: BlockRendererProps<EmbedProps>) {
  if (!props.embedUrl) {
    return (
      <div className={styles.placeholder}>
        <CodeIcon />
        <span>Вставьте ссылку для встраивания виджета</span>
      </div>
    );
  }

  return (
    <figure className={styles.embed}>
      <iframe
        src={props.embedUrl}
        title={props.caption || 'Встроенный контент'}
        style={{ height: props.height }}
      />
      {props.caption && (
        <figcaption className={styles['embed__caption']}>{props.caption}</figcaption>
      )}
    </figure>
  );
}

const embedFields: FieldSchema[] = [
  {
    key: 'embedUrl',
    label: 'Ссылка для встраивания',
    control: 'url',
    hint: 'Calendly, форма, виджет бронирования и т. п.',
  },
  { key: 'height', label: 'Высота (px)', control: 'number', min: 200, max: 1200, step: 20 },
  { key: 'caption', label: 'Подпись', control: 'text' },
];

registerBlock<EmbedProps>({
  type: 'embed',
  label: 'Встраиваемый виджет',
  category: 'utility',
  icon: CodeIcon,
  description: 'Любой сторонний виджет по ссылке для встраивания',
  defaultProps: { embedUrl: '', height: 480, caption: '' },
  fields: embedFields,
  Renderer: EmbedRenderer,
});

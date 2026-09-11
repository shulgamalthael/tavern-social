'use client';

import type { LayoutPattern } from '../model/layout-patterns';
import type { BlockBusinessContext } from '../model/registry';
import { DEFAULT_THEME } from '../model/default-theme';
import { useWebsiteBuilderStore } from '../model/website-store';
import { BlockRenderer } from './BlockRenderer';
import styles from './BlockThumbnail.module.scss';

/** Тот же плейсхолдер, что у `BlockThumbnail` — превью макета рендерится до
 * выбора, ему не нужен настоящий бизнес. */
const PLACEHOLDER_BUSINESS: BlockBusinessContext = {
  businessId: '',
  name: 'Ваш бизнес',
  logoUrl: null,
  email: null,
  phone: null,
  address: null,
  socialLinks: [],
  workingHours: null,
};

export interface LayoutPatternThumbnailProps {
  pattern: LayoutPattern;
}

/**
 * Живое превью ГОТОВОГО МАКЕТА (`layout-patterns.ts`) — в отличие от
 * `BlockThumbnail` (один тип блока), здесь целое дерево (`section` с
 * настоящими вложенными `columns`/`column`+контентом), поэтому рендерится
 * не через `definition.Renderer` напрямую, а через `BlockRenderer` —
 * тот же рекурсивный диспетчер, что и у публичной страницы, честно проходит
 * всю раскладку (реальные пропорции колонок, `gap`, `wrap`), не только
 * верхний уровень. Тот же приём масштабирования `zoom` и та же CSS-рамка
 * (`BlockThumbnail.module.scss`), что и у обычных превью блоков — визуально
 * согласованная карточка в одной сетке с остальной библиотекой.
 */
export function LayoutPatternThumbnail({ pattern }: LayoutPatternThumbnailProps) {
  const theme = useWebsiteBuilderStore((state) => state.document?.theme) ?? DEFAULT_THEME;
  const [root] = pattern.build();

  return (
    <div className={styles.thumb}>
      <div className={styles.thumb__stage}>
        <BlockRenderer
          block={root}
          theme={theme}
          viewport="desktop"
          business={PLACEHOLDER_BUSINESS}
          pages={[]}
        />
      </div>
    </div>
  );
}

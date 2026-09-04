'use client';

import type { BlockBusinessContext, BlockDefinition } from '../model/registry';
import { DEFAULT_THEME } from '../model/default-theme';
import { useWebsiteBuilderStore } from '../model/website-store';
import styles from './BlockThumbnail.module.scss';

/** Плейсхолдер вместо реального бизнеса — превью рендерится ДО того, как
 * пользователь выбрал конкретный блок, ему не нужны настоящие контакты/
 * соцсети, только форма, которую ожидают рендереры (`BlockBusinessContext`,
 * `model/registry.ts`). Пустой `businessId` — намеренно: см. `needsLive
 * Preview` ниже, блоки, которым он реально нужен для запроса, сюда не
 * попадают вообще. */
const PLACEHOLDER_BUSINESS: BlockBusinessContext = {
  businessId: '',
  name: 'Ваш бизнес',
  logoUrl: null,
  email: null,
  phone: null,
  address: null,
  socialLinks: [],
};

/** Блоки, чей живой рендер с `defaultProps` либо пуст (структурные примитивы
 * без своих полей), либо сам дозагружает данные по `businessId` (`control:
 * 'dataSource'`-поля — `productgrid`/`servicegrid`/`bloggrid`, а также
 * `web3wallet`, который делает то же самое, но без объявленного поля схемы,
 * поэтому у него `previewIcon` задан явно, не через это авто-определение) —
 * получают статичную иконку вместо живого рендера. Иначе открытие библиотеки
 * блоков либо показало бы пустое место, либо ушло бы в реальный сетевой
 * запрос с бессмысленным пустым `businessId`. */
function needsStaticPreview(definition: BlockDefinition): boolean {
  return (
    Boolean(definition.previewIcon) ||
    definition.fields.some((field) => field.control === 'dataSource')
  );
}

export interface BlockThumbnailProps {
  definition: BlockDefinition;
}

/**
 * Небольшое превью блока для библиотеки компонентов (`ComponentLibraryPanel`/
 * `AddBlockModal`, до этой фичи — голая иконка 26×26px) — живой уменьшенный
 * рендер САМОГО блока с его `defaultProps` (единственный источник правды,
 * который уже существует у каждого зарегистрированного типа), а не
 * отдельный пайплайн скриншотов: превью само остаётся актуальным при любом
 * будущем изменении дизайна блока. Рендерится с РЕАЛЬНОЙ темой текущего
 * сайта (со фолбэком на `DEFAULT_THEME`, если документ ещё не загружен) —
 * превью выглядит как кусок именно ЭТОГО сайта, не абстрактный образец.
 *
 * Масштабирование — тот же приём `zoom`, что и в устройстве предпросмотра
 * (`shared/lib/use-fit-zoom.ts`): рендерим блок на «настоящей» ширине
 * (проще для верстки блока, чем сжатая), потом визуально уменьшаем всю
 * область целиком — `zoom`, в отличие от `transform: scale`, реально влияет
 * на layout, поэтому переполнение обрезается `overflow: hidden` предсказуемо.
 */
export function BlockThumbnail({ definition }: BlockThumbnailProps) {
  const theme = useWebsiteBuilderStore((state) => state.document?.theme) ?? DEFAULT_THEME;

  if (needsStaticPreview(definition)) {
    const PreviewIcon = definition.previewIcon ?? definition.icon;
    return (
      <div className={styles.thumb}>
        <span className={styles.thumb__staticIcon}>
          <PreviewIcon />
        </span>
      </div>
    );
  }

  const Renderer = definition.Renderer;
  return (
    <div className={styles.thumb}>
      <div className={styles.thumb__stage}>
        <Renderer
          props={definition.defaultProps}
          theme={theme}
          viewport="desktop"
          business={PLACEHOLDER_BUSINESS}
          pages={[]}
        />
      </div>
    </div>
  );
}

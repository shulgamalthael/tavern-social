// Побочный эффект: регистрирует все блоки (см. `blocks/registry-index.ts`)
// — импорт публичного API этого слайса откуда угодно гарантирует, что
// реестр уже заполнен к моменту вызова `getBlockDefinition`/рендера
// `WebsiteRenderer`, без отдельного «не забудьте импортировать реестр»
// шага у каждого потребителя.
import './blocks/registry-index';

export { computeBlockWrapperStyle } from './model/block-style';
export type { BlockWrapperStyle } from './model/block-style';
export {
  createBlockId,
  countBlocks,
  findBlock,
  findParentId,
  isBlockOrDescendant,
} from './model/block-tree';
export { createEmptyWebsiteDocument, DEFAULT_THEME } from './model/default-theme';
export {
  BLOCK_CATEGORY_LABELS,
  BLOCK_CATEGORY_ORDER,
  createBlockInstance,
  getBlockDefinition,
  listBlockDefinitions,
  listVisibleBlockDefinitions,
  readResponsiveProp,
  registerBlock,
  writeResponsiveProp,
} from './model/registry';
export type {
  BlockBusinessContext,
  BlockCategory,
  BlockDefinition,
  BlockRendererProps,
  FieldSchema,
  SelectOption,
} from './model/registry';
export { pageHasHeaderCartButton } from './model/page-has-header-cart-button';
export { isBlockHidden, resolveResponsive } from './model/resolve-responsive';
export { describeLinkTarget, EMPTY_LINK_TARGET, resolveLinkHref } from './model/resolve-link';
export { resolveSitePage } from './model/resolve-site-page';
export { resolveSiteMetadataDefaults } from './lib/resolve-site-metadata';
export type { SiteMetadataDefaults } from './lib/resolve-site-metadata';
export {
  BACKGROUND_OPTIONS,
  BLOCK_SHADOW_OPTIONS,
  BORDER_WIDTH_OPTIONS,
  BUTTON_STYLE_OPTIONS,
  CARD_BORDER_OPTIONS,
  CARD_SHADOW_OPTIONS,
  CONTAINER_WIDTH_OPTIONS,
  ENTRANCE_ANIMATION_OPTIONS,
  FONT_CHOICE_OPTIONS,
  GRADIENT_TYPE_OPTIONS,
  GRID_COLUMNS_OPTIONS,
  LAYOUT_ALIGN_OPTIONS,
  LAYOUT_DIRECTION_OPTIONS,
  LAYOUT_DISPLAY_OPTIONS,
  LAYOUT_GROW_OPTIONS,
  LAYOUT_JUSTIFY_OPTIONS,
  RADIUS_OPTIONS,
  SECTION_SPACING_OPTIONS,
  SPACING_PX,
  SPACING_SIZE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  THEME_CONTAINER_WIDTH_OPTIONS,
  buildThemeCssVars,
} from './model/theme-tokens';
export { GOOGLE_FONT_OPTIONS } from './model/google-fonts';
export type { GoogleFontId } from './model/google-fonts';
export { LAYOUT_PATTERNS } from './model/layout-patterns';
export type { LayoutPattern } from './model/layout-patterns';
export type {
  Background,
  ContainerWidth,
  DataSourceValue,
  FontChoice,
  LayoutAlign,
  LayoutDirection,
  LayoutDisplay,
  LayoutJustify,
  ResponsiveValue,
  SectionSpacing,
  SpacingSize,
  SpacingValue,
  TextAlign,
  ThemeCardBorder,
  ThemeCardShadow,
  ThemeRadius,
  Viewport,
  WebsiteBlock,
  AdvancedCssProperty,
  BlockStyle,
  LinkTarget,
  WebsiteDocument,
  WebsitePage,
  WebsiteSettings,
  WebsiteTheme,
  WebsiteThemeColors,
} from './model/types';
export { VIEWPORT_FRAME_WIDTH } from './model/types';
export { useAutosave } from './model/use-autosave';
export { useRealViewport } from './model/use-real-viewport';
export { useWebsiteBuilderStore } from './model/website-store';
export type { WebsiteBuilderStore } from './model/website-store';

export { getAnonymousPublicSite } from './api/get-anonymous-public-site';
export { getPublicWebsite } from './api/get-public-website';
export type { PublicWebsite } from './api/get-public-website';
export { getWebsiteDraft } from './api/get-website-draft';
export type { WebsiteDraft } from './api/get-website-draft';
export { publishWebsite } from './api/publish-website';
export { saveWebsiteDraft } from './api/save-website-draft';
export type { SaveWebsiteDraftResult } from './api/save-website-draft';
export { uploadWebsiteAsset } from './api/upload-website-asset';

export { BLANK_TEMPLATE_ICON, STARTER_TEMPLATES } from './templates';
export type { StarterTemplate } from './templates';

export { BlockRenderer } from './ui/BlockRenderer';
export { BlockThumbnail } from './ui/BlockThumbnail';
export { LayoutPatternThumbnail } from './ui/LayoutPatternThumbnail';
export { GoogleFontLink } from './ui/GoogleFontLink';
export { WebsiteRenderer } from './ui/WebsiteRenderer';

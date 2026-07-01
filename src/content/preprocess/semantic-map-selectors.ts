import type { SemanticMapConfig } from '../adapters/adapter-types.js';

export type ResolvedSemanticSelectors = {
  blockSelector: string;
  paragraphSelector: string;
  dividerSelector: string;
  headingSelector: string;
  quoteSelector: string;
  orderedListSelector: string;
  unorderedListSelector: string;
  imageSelector: string;
  imageGallerySelector: string;
  codeSelector: string;
  tableSelector: string;
  linkSelector: string;
  textSelector: string;
};

const DEFAULT_SEMANTIC_SELECTORS: ResolvedSemanticSelectors = {
  blockSelector: '[data-block], p, hr, [role="separator"], [data-kind="divider"], h1, h2, h3, h4, h5, h6, blockquote, li, figure, img, pre, code, table',
  paragraphSelector: '[data-linelens-block-role="paragraph"], [data-kind="paragraph"], p',
  dividerSelector: '[data-linelens-block-role="divider"], [data-kind="divider"], hr, [role="separator"]',
  headingSelector: '[data-linelens-block-role="heading"], [data-kind="heading"], h1, h2, h3, h4, h5, h6',
  quoteSelector: '[data-linelens-block-role="quote"], [data-kind="quote"], blockquote',
  orderedListSelector: '[data-linelens-list-kind="ordered"], [data-kind="ordered-list"], ol > li',
  unorderedListSelector: '[data-linelens-list-kind="unordered"], [data-kind="unordered-list"], ul > li',
  imageSelector: '[data-linelens-block-role="image"] img, [data-kind="image"] img, figure img, picture img, img',
  imageGallerySelector: '[data-linelens-block-role="image-gallery"], [data-kind="image-gallery"], figure',
  codeSelector: '[data-linelens-block-role="code"], [data-kind="code"], pre, code',
  tableSelector: 'table, [role="table"], [role="grid"]',
  linkSelector: 'a[href], [role="link"]',
  textSelector: '[data-text="true"]'
};

export function resolveSemanticSelectors(map: SemanticMapConfig | undefined): ResolvedSemanticSelectors {
  return {
    blockSelector: resolveSelector(map?.blockSelector, DEFAULT_SEMANTIC_SELECTORS.blockSelector),
    paragraphSelector: resolveSelector(map?.paragraphSelector, DEFAULT_SEMANTIC_SELECTORS.paragraphSelector),
    dividerSelector: resolveSelector(map?.dividerSelector, DEFAULT_SEMANTIC_SELECTORS.dividerSelector),
    headingSelector: resolveSelector(map?.headingSelector, DEFAULT_SEMANTIC_SELECTORS.headingSelector),
    quoteSelector: resolveSelector(map?.quoteSelector, DEFAULT_SEMANTIC_SELECTORS.quoteSelector),
    orderedListSelector: resolveSelector(map?.orderedListSelector, DEFAULT_SEMANTIC_SELECTORS.orderedListSelector),
    unorderedListSelector: resolveSelector(map?.unorderedListSelector, DEFAULT_SEMANTIC_SELECTORS.unorderedListSelector),
    imageSelector: resolveSelector(map?.imageSelector, DEFAULT_SEMANTIC_SELECTORS.imageSelector),
    imageGallerySelector: resolveSelector(map?.imageGallerySelector, DEFAULT_SEMANTIC_SELECTORS.imageGallerySelector),
    codeSelector: resolveSelector(map?.codeSelector, DEFAULT_SEMANTIC_SELECTORS.codeSelector),
    tableSelector: resolveSelector(map?.tableSelector, DEFAULT_SEMANTIC_SELECTORS.tableSelector),
    linkSelector: resolveSelector(map?.linkSelector, DEFAULT_SEMANTIC_SELECTORS.linkSelector),
    textSelector: resolveSelector(map?.textSelector, DEFAULT_SEMANTIC_SELECTORS.textSelector)
  };
}

function resolveSelector(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

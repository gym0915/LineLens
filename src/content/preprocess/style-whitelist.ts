import type { StyleWhitelistConfig } from '../../shared/reader-config.js';

export type StyleWhitelistContext = {
  isLink: boolean;
  isInlineEmphasis: boolean;
  isPreformatted: boolean;
  isCodeLike: boolean;
  isReadableText: boolean;
  isTableLike: boolean;
  matchesCustomColorSelector: boolean;
};

export type StylePropertyContext = StyleWhitelistContext & {
  value: string;
};

const EMPHASIS_STYLE_PROPS = new Set(['font-weight', 'font-style', 'text-decoration']);
const READABLE_TEXT_STYLE_PROPS = new Set(['color', 'font-size', 'line-height', 'text-align', 'font-style', 'font-weight']);
const CODE_STYLE_PROPS = new Set([
  'background',
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'tab-size',
  'white-space'
]);
const TABLE_STYLE_PROPS = new Set([
  'background',
  'background-color',
  'border',
  'border-color',
  'border-style',
  'border-width',
  'color',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-align'
]);

export function applyStyleWhitelistToTree(root: Element, config: StyleWhitelistConfig): void {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const inlineStyle = element.getAttribute('style');
    if (inlineStyle === null) {
      continue;
    }

    const filteredStyle = filterInlineStyle(inlineStyle, config, getStyleWhitelistContext(element, config));
    if (filteredStyle === '') {
      element.removeAttribute('style');
      continue;
    }

    element.setAttribute('style', filteredStyle);
  }
}

export function filterInlineStyle(
  inlineStyle: string,
  config: StyleWhitelistConfig,
  context: StyleWhitelistContext
): string {
  const preservedDeclarations: string[] = [];

  for (const declaration of parseInlineStyle(inlineStyle)) {
    if (
      shouldPreserveStyleProperty(declaration.property, config, {
        ...context,
        value: declaration.value
      })
    ) {
      preservedDeclarations.push(`${declaration.property}: ${declaration.value}`);
    }
  }

  return preservedDeclarations.join('; ');
}

export function shouldPreserveStyleProperty(
  property: string,
  config: StyleWhitelistConfig,
  context: StylePropertyContext
): boolean {
  const normalizedProperty = property.toLowerCase().trim();
  const normalizedValue = context.value.toLowerCase().trim();
  const preserveProps = new Set(config.preserveProps.map((prop) => prop.toLowerCase().trim()));

  if (normalizedProperty === 'color') {
    const preserveColorFor = config.preserveColorFor ?? [];
    return (
      (context.isLink && preserveColorFor.includes('link')) ||
      (context.isInlineEmphasis && preserveColorFor.includes('inline-emphasis')) ||
      (context.matchesCustomColorSelector && preserveColorFor.includes('custom-selector')) ||
      context.isReadableText ||
      context.isCodeLike ||
      context.isTableLike
    );
  }

  if (context.isCodeLike && CODE_STYLE_PROPS.has(normalizedProperty)) {
    return true;
  }

  if (context.isTableLike && TABLE_STYLE_PROPS.has(normalizedProperty)) {
    return true;
  }

  if (context.isReadableText && READABLE_TEXT_STYLE_PROPS.has(normalizedProperty)) {
    return true;
  }

  if (normalizedProperty === 'white-space') {
    return (
      context.isPreformatted &&
      (config.preserveWhiteSpaceValues ?? []).map((value) => value.toLowerCase().trim()).includes(normalizedValue)
    );
  }

  if (EMPHASIS_STYLE_PROPS.has(normalizedProperty)) {
    return preserveProps.has(normalizedProperty);
  }

  return preserveProps.has(normalizedProperty);
}

function getStyleWhitelistContext(element: Element, config: StyleWhitelistConfig): StyleWhitelistContext {
  return {
    isLink: isLinkElement(element),
    isInlineEmphasis: isInlineEmphasisElement(element),
    isPreformatted: isPreformattedElement(element),
    isCodeLike: isCodeLikeElement(element),
    isReadableText: isReadableTextElement(element),
    isTableLike: isTableLikeElement(element),
    matchesCustomColorSelector: matchesCustomColorSelector(element, config)
  };
}

function isLinkElement(element: Element): boolean {
  return element.tagName.toUpperCase() === 'A' || element.getAttribute('role') === 'link';
}

function isPreformattedElement(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();
  return tagName === 'PRE' || tagName === 'CODE';
}

function isCodeLikeElement(element: Element): boolean {
  return isPreformattedElement(element) || element.closest('[data-testid="markdown-code-block"], pre, code') !== null;
}

function isTableLikeElement(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();
  return (
    tagName === 'TABLE' ||
    tagName === 'THEAD' ||
    tagName === 'TBODY' ||
    tagName === 'TR' ||
    tagName === 'TH' ||
    tagName === 'TD' ||
    ['table', 'grid', 'row', 'columnheader', 'rowheader', 'cell', 'gridcell'].includes(element.getAttribute('role') ?? '') ||
    element.closest('table, [role="table"], [role="grid"], [data-testid="markdown-table"]') !== null
  );
}

function isReadableTextElement(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();
  return (
    element.hasAttribute('data-text') ||
    element.hasAttribute('data-block') ||
    isLinkElement(element) ||
    ['P', 'SPAN', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(tagName)
  );
}

function isInlineEmphasisElement(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();
  return tagName === 'STRONG' || tagName === 'B' || tagName === 'EM' || tagName === 'I' || element.hasAttribute('data-text');
}

function matchesCustomColorSelector(element: Element, config: StyleWhitelistConfig): boolean {
  for (const selector of config.customColorSelectors ?? []) {
    try {
      if (element.matches(selector)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

function parseInlineStyle(inlineStyle: string): Array<{ property: string; value: string }> {
  return inlineStyle
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.length > 0)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) {
        return null;
      }

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();
      if (property === '' || value === '') {
        return null;
      }

      return { property, value };
    })
    .filter((declaration): declaration is { property: string; value: string } => declaration !== null);
}

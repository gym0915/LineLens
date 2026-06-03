import type { StyleWhitelistConfig } from '../../shared/reader-config.js';

export type StyleWhitelistContext = {
  isLink: boolean;
  isPreformatted: boolean;
  matchesCustomColorSelector: boolean;
};

export type StylePropertyContext = StyleWhitelistContext & {
  value: string;
};

const EMPHASIS_STYLE_PROPS = new Set(['font-weight', 'font-style', 'text-decoration']);

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
      (context.matchesCustomColorSelector && preserveColorFor.includes('custom-selector'))
    );
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
    isPreformatted: isPreformattedElement(element),
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

import type { CodeBlock, CodeBlockStyle, CodeToken } from '../../../shared/article.js';
import { normalizeCodeText } from '../../../shared/text.js';
import type { ResolvedSemanticSelectors } from '../semantic-map-selectors.js';

export type CodeBlockConverterDeps = {
  blockId: string;
  consumedElements: Set<Element>;
  semanticSelectors: ResolvedSemanticSelectors;
  rootBlockAncestors(element: Element): Iterable<Element>;
  normalizeCodeLanguage(language: string): string;
  extractCodeBlockStyle(codeRoot: Element | null, pre: Element | null, code: Element | null): CodeBlockStyle;
  extractCodeTokens(code: Element | null): CodeToken[] | undefined;
};

export function convertCodeElement(element: Element, deps: CodeBlockConverterDeps): CodeBlock | null {
  const codeRoot = element.matches(deps.semanticSelectors.codeSelector)
    ? element
    : element.querySelector(deps.semanticSelectors.codeSelector);
  const code = codeRoot?.matches('code') ? codeRoot : codeRoot?.querySelector('pre code, code');
  const pre = codeRoot?.matches('pre') ? codeRoot : codeRoot?.querySelector('pre');
  const text = normalizeCodeText(code?.textContent ?? pre?.textContent ?? codeRoot?.textContent ?? '');
  if (text === '') {
    return null;
  }

  deps.consumedElements.add(element);
  if (codeRoot) {
    deps.consumedElements.add(codeRoot);
    for (const ancestor of Array.from(deps.rootBlockAncestors(codeRoot))) {
      deps.consumedElements.add(ancestor);
    }
  }

  const languageClass = Array.from(code?.classList ?? [])
    .find((className) => className.startsWith('language-'))
    ?.replace(/^language-/, '');
  const headerLanguage = normalizeText(codeRoot?.querySelector<HTMLElement>(':scope > div:first-child span')?.textContent ?? '');
  const language = deps.normalizeCodeLanguage(languageClass || headerLanguage);

  return {
    id: deps.blockId,
    type: 'code',
    text,
    ...(language ? { language } : {}),
    codeStyle: deps.extractCodeBlockStyle(codeRoot ?? null, pre ?? null, code ?? null),
    tokens: deps.extractCodeTokens(code ?? null)
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

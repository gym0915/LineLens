import type { ArticleExtractor, ExtractorContext, ExtractorMatch } from '../shared/extractor-types.js';

export type RegistryMatch = {
  extractor: ArticleExtractor;
  result: ExtractorMatch;
};

export function createExtractorRegistry(extractors: ArticleExtractor[]) {
  return {
    match(context: ExtractorContext): RegistryMatch | null {
      const matches = extractors
        .map((extractor) => {
          const result = extractor.match(context);
          return result ? { extractor, result } : null;
        })
        .filter((match): match is RegistryMatch => match !== null)
        .sort((a, b) => b.result.confidence - a.result.confidence);

      return matches[0] ?? null;
    }
  };
}

import type { ArticleBlock } from '../../shared/article.js';
import type { PlatformAdapter } from '../adapters/adapter-types.js';
import '../extractors/configurable/register-built-in-special-handlers.js';
import { convertCleanTreeToBlocks } from './clean-tree-block-converter.js';
import { cloneContentTree, createCleanTreeContext } from './clone-content-tree.js';

export const CLEAN_TREE_PRIMARY_BLOCK_TYPES: Array<ArticleBlock['type']> = [
  'paragraph',
  'heading',
  'quote',
  'list',
  'image',
  'code',
  'table',
  'simple-tweet',
  'image-gallery',
  'embed'
];

// X video and GIF blocks still depend on tab-scoped HLS capture, poster/media
// matching, and playback metadata from the legacy path. Remove them from this
// list only after a dedicated clean-tree handler emits equivalent blocks and
// the X media + Reader restore verifiers cover the replacement path.
export const HIGH_RISK_DUAL_TRACK_BLOCK_TYPES: Array<ArticleBlock['type']> = [
  'video',
  'gif'
];

// Standalone LinkBlock is an X legacy compatibility shape. The clean-tree path
// already preserves inline links as text annotations, but it does not emit a
// separate LinkBlock. Remove this legacy-only exception only after clean-tree
// has a dedicated standalone link converter and Reader restore coverage.
export const LEGACY_ONLY_BLOCK_TYPES: Array<ArticleBlock['type']> = [
  'link'
];

export type CleanTreePrimaryBlocksResult = {
  blocks: ArticleBlock[];
  cleanTreeBlocks: ArticleBlock[];
  replacedBlockCount: number;
  fallbackBlockCount: number;
  highRiskBlockCount: number;
  legacyOnlyBlockCount: number;
};

export function buildCleanTreePrimaryBlocks(params: {
  sourceRoot: Element;
  adapter: PlatformAdapter;
  sourceUrl: string;
  debugId: string;
  legacyBlocks?: ArticleBlock[];
}): CleanTreePrimaryBlocksResult {
  const context = createCleanTreeContext({
    adapter: params.adapter,
    sourceUrl: params.sourceUrl,
    debugId: params.debugId
  });
  const cleanTree = cloneContentTree(params.sourceRoot, context);
  const cleanTreeBlocks = convertCleanTreeToBlocks(cleanTree.root, context, {
    enabledBlockTypes: CLEAN_TREE_PRIMARY_BLOCK_TYPES
  });

  const mergeStats = mergeCleanTreePrimaryBlocks(params.legacyBlocks ?? [], cleanTreeBlocks);

  return {
    ...mergeStats,
    blocks: params.legacyBlocks ? mergeStats.blocks : cleanTreeBlocks
  };
}

export function mergeCleanTreePrimaryBlocks(
  legacyBlocks: ArticleBlock[],
  cleanTreeBlocks: ArticleBlock[]
): CleanTreePrimaryBlocksResult {
  let cleanTreeCursor = 0;
  let replacedBlockCount = 0;
  let fallbackBlockCount = 0;
  let highRiskBlockCount = 0;
  let legacyOnlyBlockCount = 0;

  const blocks = legacyBlocks.map((legacyBlock) => {
    if (!CLEAN_TREE_PRIMARY_BLOCK_TYPES.includes(legacyBlock.type)) {
      if (HIGH_RISK_DUAL_TRACK_BLOCK_TYPES.includes(legacyBlock.type)) {
        highRiskBlockCount += 1;
      } else if (LEGACY_ONLY_BLOCK_TYPES.includes(legacyBlock.type)) {
        legacyOnlyBlockCount += 1;
      }
      return legacyBlock;
    }

    const match = findEquivalentCleanTreeBlock(legacyBlock, cleanTreeBlocks, cleanTreeCursor);
    if (match === null) {
      fallbackBlockCount += 1;
      return legacyBlock;
    }

    cleanTreeCursor = match.index + 1;
    replacedBlockCount += 1;
    const mergedBlock = mergeCleanTreeBlockWithLegacyRuntimeFields(legacyBlock, match.block);
    return {
      ...mergedBlock,
      id: legacyBlock.id
    };
  });

  return {
    blocks,
    cleanTreeBlocks,
    fallbackBlockCount,
    highRiskBlockCount,
    legacyOnlyBlockCount,
    replacedBlockCount
  };
}

function mergeCleanTreeBlockWithLegacyRuntimeFields(legacyBlock: ArticleBlock, cleanTreeBlock: ArticleBlock): ArticleBlock {
  if (legacyBlock.type === 'paragraph' && cleanTreeBlock.type === 'paragraph' && (legacyBlock.role === 'caption' || cleanTreeBlock.role === 'caption')) {
    return {
      ...cleanTreeBlock,
      role: 'caption',
      textStyle: {
        ...cleanTreeBlock.textStyle,
        ...legacyBlock.textStyle
      }
    };
  }

  if (legacyBlock.type === 'image-gallery' && cleanTreeBlock.type === 'image-gallery') {
    return {
      ...cleanTreeBlock,
      ...(legacyBlock.layout ? { layout: legacyBlock.layout } : {})
    };
  }

  return cleanTreeBlock;
}

function findEquivalentCleanTreeBlock(
  legacyBlock: ArticleBlock,
  cleanTreeBlocks: ArticleBlock[],
  startIndex: number
): { block: ArticleBlock; index: number } | null {
  for (let index = startIndex; index < cleanTreeBlocks.length; index += 1) {
    const cleanTreeBlock = cleanTreeBlocks[index];
    if (areEquivalentBlocks(legacyBlock, cleanTreeBlock)) {
      return { block: cleanTreeBlock, index };
    }
  }

  return null;
}

function areEquivalentBlocks(left: ArticleBlock, right: ArticleBlock): boolean {
  if (left.type !== right.type) {
    return false;
  }

  switch (left.type) {
    case 'heading':
      return right.type === 'heading' && normalizeText(left.text) === normalizeText(right.text) && left.level === right.level;
    case 'paragraph':
      return right.type === 'paragraph' && normalizeText(left.text) === normalizeText(right.text);
    case 'quote':
      return right.type === 'quote' && normalizeText(left.text) === normalizeText(right.text);
    case 'list':
      return right.type === 'list' && left.kind === right.kind && normalizeText(left.items.join('\n')) === normalizeText(right.items.join('\n'));
    case 'image':
      return right.type === 'image' && left.src === right.src;
    case 'code':
      return (
        right.type === 'code' &&
        normalizeText(left.text) === normalizeText(right.text) &&
        normalizeCodeLanguageForComparison(left.language) === normalizeCodeLanguageForComparison(right.language)
      );
    case 'table':
      return (
        right.type === 'table' &&
        left.rows.length === right.rows.length &&
        left.rows.every((row, rowIndex) => {
          const otherRow = right.rows[rowIndex];
          return (
            otherRow !== undefined &&
            row.cells.length === otherRow.cells.length &&
            row.cells.every((cell, cellIndex) => normalizeText(cell.text) === normalizeText(otherRow.cells[cellIndex]?.text ?? ''))
          );
        })
      );
    case 'simple-tweet':
      return (
        right.type === 'simple-tweet' &&
        normalizeText(left.title) === normalizeText(right.title) &&
        normalizeText(left.excerpt) === normalizeText(right.excerpt) &&
        normalizeText(left.href ?? '') === normalizeText(right.href ?? '') &&
        left.items.length === right.items.length &&
        left.items.every((item, index) => {
          const other = right.items[index];
          if (!other || item.type !== other.type) {
            return false;
          }
          switch (item.type) {
            case 'text':
              return other.type === 'text' && normalizeText(item.text) === normalizeText(other.text);
            case 'photo':
              return other.type === 'photo' && item.photo.src === other.photo.src;
            case 'photo-group':
              return (
                other.type === 'photo-group' &&
                item.photos.map((photo) => photo.src).join('|') === other.photos.map((photo) => photo.src).join('|') &&
                serializeSimpleTweetPhotoLayout(item.layout) === serializeSimpleTweetPhotoLayout(other.layout)
              );
            case 'video':
              return other.type === 'video' && item.video.src === other.video.src;
            case 'video-preview':
              return other.type === 'video-preview' && item.src === other.src;
            case 'article-cover':
              return other.type === 'article-cover' && item.coverUrl === other.coverUrl;
            case 'quoted-tweet':
              return (
                other.type === 'quoted-tweet' &&
                normalizeText(item.tweet.title) === normalizeText(other.tweet.title) &&
                normalizeText(item.tweet.excerpt) === normalizeText(other.tweet.excerpt) &&
                item.tweet.items.length === other.tweet.items.length
              );
            default:
              return false;
          }
        })
      );
    case 'image-gallery':
      return (
        right.type === 'image-gallery' &&
        left.items.length === right.items.length &&
        left.items.every((item, index) => item.src === right.items[index]?.src)
      );
    case 'embed':
      return (
        right.type === 'embed' &&
        normalizeText(left.label) === normalizeText(right.label) &&
        normalizeText(left.text ?? '') === normalizeText(right.text ?? '') &&
        normalizeText(left.href ?? '') === normalizeText(right.href ?? '')
      );
    default:
      return false;
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?，。！？；：])/g, '$1')
    .trim();
}

function normalizeCodeLanguageForComparison(language: string | undefined): string {
  const normalized = normalizeText(language ?? '').toLowerCase();
  return normalized === 'text' || normalized === 'plain' ? '' : normalized;
}

function serializeSimpleTweetPhotoLayout(
  layout:
    | {
        kind: 'photo';
        photo: { src: string };
        widthRatio?: number;
        heightRatio?: number;
      }
    | {
        kind: 'row' | 'column';
        children: Array<any>;
        widthRatio?: number;
        heightRatio?: number;
      }
): string {
  const size = serializeSimpleTweetPhotoLayoutSize(layout);
  if (layout.kind === 'photo') {
    return `photo${size}:${layout.photo.src}`;
  }

  return `${layout.kind}${size}(${layout.children.map((child) => serializeSimpleTweetPhotoLayout(child)).join(',')})`;
}

function serializeSimpleTweetPhotoLayoutSize(layout: { widthRatio?: number; heightRatio?: number }): string {
  const parts = [
    layout.widthRatio ? `w=${layout.widthRatio}` : '',
    layout.heightRatio ? `h=${layout.heightRatio}` : ''
  ].filter(Boolean);
  return parts.length > 0 ? `[${parts.join(',')}]` : '';
}

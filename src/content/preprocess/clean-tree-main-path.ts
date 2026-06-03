import type { ArticleBlock } from '../../shared/article.js';
import type { PlatformAdapter } from '../adapters/adapter-types.js';
import { convertCleanTreeToBlocks } from './clean-tree-block-converter.js';
import { cloneContentTree, createCleanTreeContext } from './clone-content-tree.js';

export const CLEAN_TREE_PRIMARY_BLOCK_TYPES: Array<ArticleBlock['type']> = [
  'paragraph',
  'heading',
  'quote',
  'list',
  'image'
];

export const HIGH_RISK_DUAL_TRACK_BLOCK_TYPES: Array<ArticleBlock['type']> = [
  'video',
  'simple-tweet',
  'code',
  'image-gallery'
];

export type CleanTreePrimaryBlocksResult = {
  blocks: ArticleBlock[];
  cleanTreeBlocks: ArticleBlock[];
  replacedBlockCount: number;
  fallbackBlockCount: number;
  highRiskBlockCount: number;
};

export function buildCleanTreePrimaryBlocks(params: {
  sourceRoot: Element;
  adapter: PlatformAdapter;
  sourceUrl: string;
  debugId: string;
  legacyBlocks: ArticleBlock[];
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

  return mergeCleanTreePrimaryBlocks(params.legacyBlocks, cleanTreeBlocks);
}

export function mergeCleanTreePrimaryBlocks(
  legacyBlocks: ArticleBlock[],
  cleanTreeBlocks: ArticleBlock[]
): CleanTreePrimaryBlocksResult {
  let cleanTreeCursor = 0;
  let replacedBlockCount = 0;
  let fallbackBlockCount = 0;
  let highRiskBlockCount = 0;

  const blocks = legacyBlocks.map((legacyBlock) => {
    if (!CLEAN_TREE_PRIMARY_BLOCK_TYPES.includes(legacyBlock.type)) {
      if (HIGH_RISK_DUAL_TRACK_BLOCK_TYPES.includes(legacyBlock.type)) {
        highRiskBlockCount += 1;
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
    return {
      ...match.block,
      id: legacyBlock.id
    };
  });

  return {
    blocks,
    cleanTreeBlocks,
    fallbackBlockCount,
    highRiskBlockCount,
    replacedBlockCount
  };
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
    default:
      return false;
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

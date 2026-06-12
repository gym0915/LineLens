import type { SimpleTweetCardData, SimpleTweetContentItem, SimpleTweetLayoutNode } from '../../../shared/article.js';

type LayoutProps = Pick<
  Extract<SimpleTweetLayoutNode, { kind: 'container' }>,
  'display' | 'flexDirection' | 'gridTemplateColumns' | 'gapPx' | 'alignItems' | 'justifyContent' | 'widthRatio' | 'heightRatio' | 'aspectRatio'
>;

type BuildContext = {
  tweetRoot: Element;
  tweet: Element;
  items: SimpleTweetContentItem[];
  prefix: string;
};

export function extractSimpleTweetLayoutTree(
  tweetRoot: Element,
  tweet: Element,
  items: SimpleTweetContentItem[]
): SimpleTweetLayoutNode | null {
  if (!items.length) {
    return null;
  }

  const bodyChildren = buildSimpleTweetLayoutChildren({ tweetRoot, tweet, items, prefix: 'item' });
  if (!bodyChildren.length) {
    return null;
  }

  return {
    kind: 'container',
    role: 'root',
    display: 'block',
    ...extractLayoutProps(tweetRoot),
    children: [
      {
        kind: 'container',
        role: 'body',
        display: 'block',
        ...extractLayoutProps(tweet),
        children: bodyChildren
      }
    ]
  };
}

function buildSimpleTweetLayoutChildren(context: BuildContext): SimpleTweetLayoutNode[] {
  return context.items
    .map((item, index) => buildSimpleTweetLayoutNodeForItem(item, index, context))
    .filter((node): node is SimpleTweetLayoutNode => node !== null);
}

function buildSimpleTweetLayoutNodeForItem(
  item: SimpleTweetContentItem,
  index: number,
  context: BuildContext
): SimpleTweetLayoutNode | null {
  const contentRef = `${context.prefix}:${index}`;
  switch (item.type) {
    case 'text':
      return {
        kind: 'leaf',
        role: 'text',
        contentRef
      };
    case 'photo':
      return {
        kind: 'leaf',
        role: 'photo',
        contentRef
      };
    case 'photo-group':
      return {
        kind: 'leaf',
        role: 'photo',
        contentRef
      };
    case 'video':
    case 'video-preview':
      return {
        kind: 'leaf',
        role: 'video',
        contentRef
      };
    case 'article-cover':
      return {
        kind: 'leaf',
        role: 'photo',
        contentRef
      };
    case 'quoted-tweet': {
      const quotedRoot = findQuotedTweetRoot(context.tweetRoot, index);
      const quotedTweet = quotedRoot?.matches('[data-testid="tweet"]')
        ? quotedRoot
        : quotedRoot?.querySelector('[data-testid="tweet"]') ?? quotedRoot ?? context.tweet;
      const children = buildSimpleTweetLayoutChildren({
        tweetRoot: quotedRoot ?? context.tweetRoot,
        tweet: quotedTweet,
        items: item.tweet.items,
        prefix: `${contentRef}:item`
      });

      return {
        kind: 'container',
        role: 'quotedTweet',
        display: inferQuotedDisplay(quotedRoot, item.tweet),
        flexDirection: inferQuotedFlexDirection(quotedRoot, item.tweet),
        ...extractLayoutProps(quotedRoot),
        children
      };
    }
  }
}

function findMediaLayoutElement(tweet: Element, role: 'photo' | 'video'): Element | null {
  const selector = role === 'photo'
    ? '[data-testid="tweetPhoto"]'
    : '[data-testid="videoPlayer"], [data-testid="previewInterstitial"]';
  const media = tweet.querySelector(selector);
  if (!media) {
    return null;
  }

  let best: Element | null = media;
  for (let current = media.parentElement; current && current !== tweet; current = current.parentElement) {
    if (current.querySelectorAll(selector).length > 1 || hasLayoutDisplay(current)) {
      best = current;
    }
  }
  return best;
}

function findQuotedTweetRoot(tweetRoot: Element, itemIndex: number): Element | null {
  const quotedIndex = countQuotedItemsBefore(tweetRoot, itemIndex);
  const quotedRoots = collectQuotedTweetLayoutRoots(tweetRoot);
  return quotedRoots[quotedIndex] ?? null;
}

function countQuotedItemsBefore(tweetRoot: Element, itemIndex: number): number {
  const roots = collectQuotedTweetLayoutRoots(tweetRoot);
  if (!roots.length) {
    return 0;
  }
  return Math.max(0, Math.min(itemIndex, roots.length - 1));
}

function collectQuotedTweetLayoutRoots(tweetRoot: Element): Element[] {
  const candidates = Array.from(tweetRoot.querySelectorAll('[data-testid="simpleTweet"], [data-testid="tweet"], [role="link"]')).filter((candidate) => {
    if (candidate === tweetRoot) {
      return false;
    }
    if (!candidate.querySelector('[data-testid="User-Name"]')) {
      return false;
    }
    return Boolean(
      candidate.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"], [data-testid="previewInterstitial"], [data-testid="videoPlayer"], [data-testid="article-cover-image"]')
    );
  });

  return candidates.filter((candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)));
}

function inferMediaDisplay(count: number): 'block' | 'flex' | 'grid' {
  return count > 1 ? 'grid' : 'block';
}

function inferQuotedDisplay(root: Element | null, tweet: SimpleTweetCardData): 'block' | 'flex' | 'grid' {
  const props = extractLayoutProps(root);
  if (props.display) {
    return props.display === 'inline-flex' ? 'flex' : props.display;
  }
  const hasMedia = tweet.items.some((item) => item.type !== 'text');
  const hasText = tweet.items.some((item) => item.type === 'text');
  return hasMedia && hasText ? 'flex' : 'block';
}

function inferQuotedFlexDirection(root: Element | null, tweet: SimpleTweetCardData): LayoutProps['flexDirection'] {
  const props = extractLayoutProps(root);
  if (props.flexDirection) {
    return props.flexDirection;
  }
  const hasMedia = tweet.items.some((item) => item.type !== 'text');
  const hasText = tweet.items.some((item) => item.type === 'text');
  return hasMedia && hasText ? 'row' : undefined;
}

function extractLayoutProps(element: Element | null | undefined): LayoutProps {
  if (!element) {
    return {};
  }

  const style = readComputedLayoutStyle(element);
  const display = normalizeDisplay(style.display);
  const flexDirection = normalizeFlexDirection(style.flexDirection);
  const gridTemplateColumns = normalizeGridTemplateColumns(style.gridTemplateColumns);
  const gapPx = parsePixelValue(style.columnGap || style.gap) ?? parsePixelValue(style.rowGap);
  const aspectRatio = parseAspectRatio(style.aspectRatio) ?? getAspectRatioFromPadding(element);

  return compactLayoutProps({
    display,
    flexDirection,
    gridTemplateColumns,
    gapPx,
    alignItems: normalizeKeyword(style.alignItems),
    justifyContent: normalizeKeyword(style.justifyContent),
    ...getElementRatio(element),
    aspectRatio
  });
}

function readComputedLayoutStyle(element: Element): {
  display: string;
  flexDirection: string;
  gridTemplateColumns: string;
  gap: string;
  columnGap: string;
  rowGap: string;
  alignItems: string;
  justifyContent: string;
  aspectRatio: string;
} {
  const inlineStyle = element instanceof HTMLElement ? element.style : null;
  const computedStyle =
    typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(element)
      : null;

  return {
    display: (inlineStyle?.display || computedStyle?.display || '').trim(),
    flexDirection: (inlineStyle?.flexDirection || computedStyle?.flexDirection || '').trim(),
    gridTemplateColumns: (inlineStyle?.gridTemplateColumns || computedStyle?.gridTemplateColumns || '').trim(),
    gap: (inlineStyle?.gap || computedStyle?.gap || '').trim(),
    columnGap: (inlineStyle?.columnGap || computedStyle?.columnGap || '').trim(),
    rowGap: (inlineStyle?.rowGap || computedStyle?.rowGap || '').trim(),
    alignItems: (inlineStyle?.alignItems || computedStyle?.alignItems || '').trim(),
    justifyContent: (inlineStyle?.justifyContent || computedStyle?.justifyContent || '').trim(),
    aspectRatio: (inlineStyle?.aspectRatio || computedStyle?.aspectRatio || '').trim()
  };
}

function hasLayoutDisplay(element: Element): boolean {
  const display = normalizeDisplay(readComputedLayoutStyle(element).display);
  return display === 'flex' || display === 'inline-flex' || display === 'grid';
}

function normalizeDisplay(value: string): LayoutProps['display'] {
  return value === 'block' || value === 'flex' || value === 'inline-flex' || value === 'grid' ? value : undefined;
}

function normalizeFlexDirection(value: string): LayoutProps['flexDirection'] {
  return value === 'row' || value === 'row-reverse' || value === 'column' || value === 'column-reverse' ? value : undefined;
}

function normalizeGridTemplateColumns(value: string): string | undefined {
  if (!value || value === 'none') {
    return undefined;
  }
  return value;
}

function normalizeKeyword(value: string): string | undefined {
  if (!value || value === 'normal' || value === 'auto') {
    return undefined;
  }
  return value;
}

function parsePixelValue(value: string): number | undefined {
  const match = /^([\d.]+)px$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const number = Number(match[1]);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : undefined;
}

function parseAspectRatio(value: string): number | undefined {
  const normalized = value.trim();
  const ratioMatch = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(normalized);
  if (ratioMatch) {
    const width = Number(ratioMatch[1]);
    const height = Number(ratioMatch[2]);
    return height > 0 ? Math.round((width / height) * 10000) / 10000 : undefined;
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function getAspectRatioFromPadding(element: Element): number | undefined {
  const ratioNode = Array.from(element.querySelectorAll<HTMLElement>('[style*="padding-bottom"]')).find((child) =>
    /padding-bottom:\s*[\d.]+%/i.test(child.getAttribute('style') ?? '')
  );
  if (!ratioNode) {
    return undefined;
  }
  const match = /padding-bottom:\s*([\d.]+)%/i.exec(ratioNode.getAttribute('style') ?? '');
  const padding = Number(match?.[1]);
  return Number.isFinite(padding) && padding > 0 ? Math.round((100 / padding) * 10000) / 10000 : undefined;
}

function getElementRatio(element: Element): Pick<LayoutProps, 'widthRatio' | 'heightRatio'> {
  const preservedWidth = readPositiveNumberAttribute(element, 'data-linelens-media-layout-width');
  const preservedHeight = readPositiveNumberAttribute(element, 'data-linelens-media-layout-height');
  if (preservedWidth || preservedHeight) {
    return {
      ...(preservedWidth ? { widthRatio: preservedWidth } : {}),
      ...(preservedHeight ? { heightRatio: preservedHeight } : {})
    };
  }

  if (!(element instanceof HTMLElement) || !element.parentElement) {
    return {};
  }
  const rect = element.getBoundingClientRect();
  const parentRect = element.parentElement.getBoundingClientRect();
  if (!rect.width || !rect.height || !parentRect.width || !parentRect.height) {
    return {};
  }
  return {
    widthRatio: Math.round((rect.width / parentRect.width) * 10000) / 10000,
    heightRatio: Math.round((rect.height / parentRect.height) * 10000) / 10000
  };
}

function readPositiveNumberAttribute(element: Element, name: string): number | undefined {
  const value = Number(element.getAttribute(name));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function compactLayoutProps<T extends Record<string, string | number | undefined>>(props: T): T {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined && value !== '')) as T;
}

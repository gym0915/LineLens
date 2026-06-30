import type { SimpleTweetCardData, SimpleTweetLayoutNode, TweetMetrics } from '../../shared/article-schema.js';
import { renderGrokIcon, renderSimpleTweetActions, renderSimpleTweetAiGeneratedBadge, renderVerifiedIcon } from './icons.js';

type SimpleTweetFrameBlock = SimpleTweetCardData & {
  metrics?: TweetMetrics;
  layoutTree?: SimpleTweetLayoutNode;
};

export type SimpleTweetFrameOptions = {
  compact: boolean;
  showActions: boolean;
};

export type RenderSimpleTweetFrameContent = (block: SimpleTweetFrameBlock, compact: boolean) => HTMLElement;

export function renderSimpleTweetCardFrame(
  block: SimpleTweetFrameBlock,
  host: HTMLElement,
  options: SimpleTweetFrameOptions,
  renderContent: RenderSimpleTweetFrameContent
): void {
  const tweetFrame = document.createElement('div');
  tweetFrame.className = 'reader-simple-tweet-frame';
  if (options.compact) {
    tweetFrame.classList.add('reader-simple-tweet-frame-compact');
  }

  const contentColumn = document.createElement('div');
  contentColumn.className = 'reader-simple-tweet-content-column';

  const header = document.createElement('div');
  header.className = 'reader-simple-tweet-header';
  header.append(renderSimpleTweetAuthor(block), renderGrokIcon());

  const shell = document.createElement('div');
  shell.className = 'reader-simple-tweet-shell';
  const content = document.createElement('div');
  content.className = 'reader-simple-tweet-content';
  content.append(renderContent(block, options.compact));
  shell.append(content);

  if (options.showActions) {
    contentColumn.append(header, shell);
    if (block.aiGeneratedText) {
      contentColumn.append(renderSimpleTweetAiGeneratedBadge(block.aiGeneratedText));
    }
    contentColumn.append(renderSimpleTweetActions(block.metrics));
  } else if (options.compact) {
    contentColumn.append(header);
    shell.classList.add('reader-simple-tweet-shell-compact');
    tweetFrame.append(renderSimpleTweetAvatar(block), contentColumn, shell);
    host.append(tweetFrame);
    return;
  } else {
    contentColumn.append(header, shell);
  }
  tweetFrame.append(renderSimpleTweetAvatar(block), contentColumn);
  host.append(tweetFrame);
}

function renderSimpleTweetAvatar(block: SimpleTweetCardData): HTMLImageElement {
  const avatar = document.createElement('img');
  avatar.className = 'reader-simple-tweet-avatar';
  avatar.src = block.authorAvatarUrl ?? 'https://pbs.twimg.com/profile_images/1921559263094218753/p2-n_n4w_x96.jpg';
  avatar.alt = '';
  avatar.loading = 'lazy';
  avatar.setAttribute('data-testid', 'Tweet-User-Avatar');
  return avatar;
}

function renderSimpleTweetAuthor(block: SimpleTweetCardData): HTMLDivElement {
  const author = document.createElement('div');
  author.className = 'reader-simple-tweet-author';

  const primary = document.createElement('div');
  primary.className = 'reader-simple-tweet-author-primary';

  const displayName = document.createElement('span');
  displayName.className = 'reader-simple-tweet-display-name';
  displayName.setAttribute('data-testid', 'User-Name');
  displayName.textContent = block.authorName ?? 'karin.';

  primary.append(displayName);
  if (block.authorVerified || (block.authorVerified === undefined && !block.authorName && !block.authorHandle)) {
    primary.append(renderVerifiedIcon());
  }
  if (block.authorBadgeAvatarUrl) {
    const badge = document.createElement('img');
    badge.className = 'reader-simple-tweet-author-badge';
    badge.src = block.authorBadgeAvatarUrl;
    badge.alt = '';
    badge.loading = 'lazy';
    primary.append(badge);
  }

  const secondary = document.createElement('div');
  secondary.className = 'reader-simple-tweet-author-secondary';

  const handle = document.createElement('span');
  handle.textContent = block.authorHandle ?? '@omokage_AIsOK';

  const separator = document.createElement('span');
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '·';

  const date = document.createElement('time');
  date.dateTime = block.publishedAt ?? '2026-02-08T16:26:18.000Z';
  date.textContent = block.publishedAtText ?? 'Feb 9';

  secondary.append(handle, separator, date);
  author.append(primary, secondary);
  return author;
}

import type { SpecialComponentHandler } from '../../adapters/index.js';
import type { EmbedBlock, TweetMetrics } from '../../../shared/article.js';

const registeredHandlers = new Map<string, SpecialComponentHandler>();

export function registerSpecialComponentHandler(handler: SpecialComponentHandler): void {
  const handlerId = handler.handlerId.trim();
  if (!handlerId) {
    return;
  }

  registeredHandlers.set(handlerId, {
    ...handler,
    handlerId
  });
}

export function getSpecialComponentHandler(handlerId: string): SpecialComponentHandler | null {
  const handler = registeredHandlers.get(handlerId);
  if (!handler) {
    return null;
  }

  return handler;
}

export function clearSpecialComponentHandlersForTest(): void {
  registeredHandlers.clear();
}

type SubstackTwitterAttrs = {
  url?: string;
  full_text?: string;
  username?: string;
  name?: string;
  profile_image_url?: string;
  date?: string;
  photos?: Array<{
    img_url?: string;
    link_url?: string;
  }>;
  reply_count?: number;
  retweet_count?: number;
  like_count?: number;
  impression_count?: number;
};

registerSpecialComponentHandler({
  handlerId: 'substack.twitter-embed',
  extract(root, context): EmbedBlock | null {
    const attrs = readSubstackTwitterAttrs(root);
    if (!attrs) {
      return null;
    }

    const href = attrs.url || root.getAttribute('href') || undefined;
    const username = normalizeText(attrs.username ?? '');
    const metrics = compactMetrics({
      replies: formatCountMetric(attrs.reply_count, 'Reply', 'Replies'),
      reposts: formatCountMetric(attrs.retweet_count, 'Repost', 'Reposts'),
      likes: formatCountMetric(attrs.like_count, 'Like', 'Likes'),
      views: formatCompactMetric(attrs.impression_count, 'View', 'Views')
    });
    const media = (attrs.photos ?? [])
      .map((photo) => {
        const src = normalizeText(photo.img_url ?? '');
        if (!src) {
          return null;
        }
        return {
          type: 'image' as const,
          src,
          ...(photo.link_url ? { href: photo.link_url } : {}),
          aspectRatio: 1,
          objectFit: 'cover' as const,
          objectPosition: 'center center'
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      id: `${context.debugId}:clean-block-${context.index}`,
      type: 'embed',
      label: 'X',
      provider: 'x',
      ...(href ? { href } : {}),
      ...(attrs.full_text ? { text: attrs.full_text } : {}),
      ...(attrs.name ? { authorName: attrs.name } : {}),
      ...(username ? { authorHandle: `@${username.replace(/^@/, '')}` } : {}),
      ...(attrs.profile_image_url ? { authorAvatarUrl: attrs.profile_image_url } : {}),
      ...(attrs.date ? { publishedAt: attrs.date, publishedAtText: formatPublishedAtText(attrs.date) } : {}),
      ...(Object.keys(metrics).length > 0 ? { metrics } : {}),
      ...(media.length > 0 ? { media } : {})
    };
  }
});

function readSubstackTwitterAttrs(root: Element): SubstackTwitterAttrs | null {
  const dataRoot = root.hasAttribute('data-attrs') ? root : root.querySelector('[data-attrs]');
  const raw = dataRoot?.getAttribute('data-attrs');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SubstackTwitterAttrs;
  } catch {
    return null;
  }
}

function compactMetrics(metrics: TweetMetrics): TweetMetrics {
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => Boolean(value))) as TweetMetrics;
}

function formatCountMetric(value: number | undefined, singular: string, plural: string): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return `${value} ${value === 1 ? singular : plural}`;
}

function formatCompactMetric(value: number | undefined, singular: string, plural: string): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const metricValue = value as number;
  const formatted = metricValue >= 1000 ? `${Math.round((metricValue / 1000) * 100) / 100}K` : String(metricValue);
  return `${formatted} ${metricValue === 1 ? singular : plural}`;
}

function formatPublishedAtText(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).formatToParts(parsed);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('hour')}:${value('minute')} ${value('dayPeriod')} · ${value('month')} ${value('day')}, ${value('year')}`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

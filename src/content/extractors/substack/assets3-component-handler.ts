import type { EmbedBlock, ParagraphBlock, TextAnnotation, TextStyle, VideoBlock } from '../../../shared/article.js';
import { normalizeText } from '../../../shared/text.js';
import { registerSpecialComponentHandler } from '../configurable/special-component-handlers.js';

const SUBSTACK_LABEL = 'Substack';

export function registerSubstackAssets3ComponentHandlers(): void {
  registerSubstackYoutubeEmbedHandler();
  registerSubstackVideoEmbedHandler();
  registerSubstackAudioEmbedHandler();
  registerSubstackFootnoteHandler();
  registerSubstackPaywallHandler();
  registerSubstackSubscribeWidgetHandler();
}

function registerSubstackYoutubeEmbedHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'substack.youtube-embed',
    extract(root, context): EmbedBlock | null {
      const iframe = findMediaElement(root, 'iframe[src], iframe[data-src], embed[src], embed[data-src]');
      const href = safeUrl(firstNonEmpty(iframe?.getAttribute('src'), iframe?.getAttribute('data-src')), context.sourceUrl);
      if (!href) {
        return null;
      }

      const title = firstNonEmpty(
        iframe?.getAttribute('title'),
        iframe?.getAttribute('aria-label'),
        readYoutubeVideoId(root) ? `YouTube video ${readYoutubeVideoId(root)}` : undefined,
        'YouTube video'
      );

      return {
        id: blockId(context.debugId, context.index),
        type: 'embed',
        label: 'YouTube',
        provider: 'youtube',
        href,
        ...(title ? { title, text: title } : {})
      };
    }
  });
}

function registerSubstackVideoEmbedHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'substack.video-embed',
    extract(root, context): VideoBlock | EmbedBlock | null {
      const video = findMediaElement(root, 'video');
      if (!video) {
        return null;
      }

      const source = firstNonEmpty(video.getAttribute('src'), video.querySelector('source[src]')?.getAttribute('src'));
      const src = safeUrl(source, context.sourceUrl);
      const poster = safeUrl(video.getAttribute('poster'), context.sourceUrl);
      const title = firstNonEmpty(
        video.getAttribute('title'),
        video.getAttribute('aria-label'),
        root.querySelector('[aria-label]')?.getAttribute('aria-label'),
        'Substack video'
      );
      const aspectRatio = readVideoAspectRatio(root, video);

      if (src) {
        return {
          id: blockId(context.debugId, context.index),
          type: 'video',
          src,
          transport: 'direct',
          ...(poster ? { poster } : {}),
          ...(aspectRatio ? { aspectRatio } : {}),
          ...(video.getAttribute('preload') ? { preload: normalizePreload(video.getAttribute('preload')) } : {}),
          ...(title ? { ariaLabel: title } : {})
        };
      }

      if (!poster && !title) {
        return null;
      }

      return {
        id: blockId(context.debugId, context.index),
        type: 'embed',
        label: SUBSTACK_LABEL,
        provider: 'substack',
        title: title ?? 'Substack video',
        text: title ?? 'Substack video',
        ...(poster
          ? {
              media: [
                {
                  type: 'image' as const,
                  src: poster,
                  alt: title ?? 'Substack video',
                  ...(aspectRatio ? { aspectRatio } : {}),
                  objectFit: 'cover' as const
                }
              ]
            }
          : {})
      };
    }
  });
}

function registerSubstackAudioEmbedHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'substack.audio-embed',
    extract(root, context): EmbedBlock | null {
      const audio = findMediaElement(root, 'audio[src]');
      const href = safeUrl(audio?.getAttribute('src'), context.sourceUrl);
      if (!href) {
        return null;
      }

      const title = firstNonEmpty(audio?.getAttribute('title'), audio?.getAttribute('aria-label'), 'Substack audio');
      const poster = safeUrl(audio?.getAttribute('data-linelens-media-cover-url'), context.sourceUrl) ?? findBackgroundImageUrl(root, context.sourceUrl);
      return {
        id: blockId(context.debugId, context.index),
        type: 'embed',
        label: SUBSTACK_LABEL,
        provider: 'substack',
        href,
        title,
        text: title,
        ...(poster
          ? {
              media: [
                {
                  type: 'image' as const,
                  src: poster,
                  href,
                  alt: title,
                  objectFit: 'cover' as const
                }
              ]
            }
          : {})
      };
    }
  });
}

function registerSubstackFootnoteHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'substack.footnote',
    extract(root, context): ParagraphBlock | null {
      const number = normalizeText(root.querySelector('.footnote-number, a[href^="#footnote-anchor"]')?.textContent ?? '');
      const contentRoot = root.querySelector('.footnote-content') ?? root;
      const richText = extractRichText(contentRoot, context.sourceUrl);
      if (!richText.text) {
        return null;
      }

      return {
        id: blockId(context.debugId, context.index),
        type: 'paragraph',
        text: number ? `Footnote ${number}: ${richText.text}` : richText.text,
        ...(richText.annotations.length > 0 ? { annotations: shiftAnnotations(richText.annotations, number ? `Footnote ${number}: `.length : 0) } : {}),
        ...(Object.keys(richText.textStyle).length > 0 ? { textStyle: richText.textStyle } : {})
      };
    }
  });
}

function registerSubstackPaywallHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'substack.paywall',
    extract(root, context): EmbedBlock | null {
      const titleElement = root.querySelector('.paywall-title, h1, h2, h3');
      const titleRichText = extractRichText(titleElement ?? root, context.sourceUrl);
      const richText = extractRichText(root, context.sourceUrl);
      const title = firstNonEmpty(titleRichText.text, root.getAttribute('aria-label'), 'This post is for paid subscribers') ?? 'This post is for paid subscribers';
      const href = firstSafeLink(root, context.sourceUrl);

      return {
        id: blockId(context.debugId, context.index),
        type: 'embed',
        label: SUBSTACK_LABEL,
        provider: 'substack',
        title,
        text: richText.text || title,
        ...(richText.annotations.length > 0 ? { textAnnotations: richText.annotations } : {}),
        ...(Object.keys(richText.textStyle).length > 0 ? { textStyle: richText.textStyle } : {}),
        ...(Object.keys(titleRichText.textStyle).length > 0 ? { titleTextStyle: titleRichText.textStyle } : {}),
        ...(href ? { href } : {})
      };
    }
  });
}

function registerSubstackSubscribeWidgetHandler(): void {
  registerSpecialComponentHandler({
    handlerId: 'substack.subscribe-widget',
    extract(root, context): EmbedBlock | null {
      const richText = extractRichText(root, context.sourceUrl);
      const visibleText = richText.text;
      const fallbackText = root.classList.contains('is-fully-subscribed') ? 'Subscribed' : 'Subscribe';
      const title = firstNonEmpty(visibleText, fallbackText) ?? fallbackText;
      const href = firstSafeLink(root, context.sourceUrl);

      return {
        id: blockId(context.debugId, context.index),
        type: 'embed',
        label: SUBSTACK_LABEL,
        presentation: 'cta',
        provider: 'substack',
        title,
        text: title,
        ...(richText.annotations.length > 0 ? { textAnnotations: richText.annotations } : {}),
        ...(Object.keys(richText.textStyle).length > 0 ? { textStyle: richText.textStyle } : {}),
        ...(href ? { href } : {})
      };
    }
  });
}

function blockId(debugId: string, index: number): string {
  return `${debugId}:clean-block-${index}`;
}

function findMediaElement<T extends Element = HTMLElement>(root: Element, selector: string): T | null {
  if (root.matches(selector)) {
    return root as T;
  }
  return root.querySelector<T>(selector);
}

function safeUrl(value: string | null | undefined, baseUrl: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed, baseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function firstSafeLink(root: Element, baseUrl: string): string | undefined {
  for (const element of Array.from(root.querySelectorAll('[href], [data-href]'))) {
    const href = safeUrl(element.getAttribute('href') ?? element.getAttribute('data-href'), baseUrl);
    if (href) {
      return href;
    }
  }
  return undefined;
}

function extractRichText(root: Element, baseUrl: string): { text: string; annotations: TextAnnotation[]; textStyle: TextStyle } {
  const text = normalizeText(root.textContent ?? '');
  return {
    text,
    annotations: extractTextAnnotations(root, text, baseUrl),
    textStyle: extractElementTextStyle(root)
  };
}

function extractTextAnnotations(root: Element, fullText: string, baseUrl: string): TextAnnotation[] {
  if (!fullText) {
    return [];
  }

  const annotations: TextAnnotation[] = [];
  let searchCursor = 0;
  for (const element of Array.from(
    root.querySelectorAll(
      'a[href], [data-href], strong, b, em, i, u, [style*="font-weight"], [style*="font-style"], [style*="text-decoration"], [style*="font-size"], [style*="line-height"], [style*="color"], [style*="text-align"]'
    )
  )) {
    const text = normalizeText(element.textContent ?? '');
    if (!text) {
      continue;
    }

    const startOffset = findTextOffset(fullText, text, searchCursor);
    if (startOffset < 0) {
      continue;
    }
    const endOffset = startOffset + text.length;
    searchCursor = endOffset;

    const annotation: TextAnnotation = {
      startOffset,
      endOffset,
      ...extractInlineTextStyle(element)
    };
    if (isBoldElement(element)) {
      annotation.bold = true;
    }
    if (isItalicElement(element)) {
      annotation.fontStyle = 'italic';
    }
    if (isUnderlineElement(element)) {
      annotation.textDecoration = 'underline';
    }

    const href = safeUrl(element.getAttribute('href') ?? element.getAttribute('data-href'), baseUrl);
    if (href) {
      annotation.href = href;
      annotation.target = element.getAttribute('target') ?? undefined;
      annotation.textDecoration ??= 'underline';
    }

    if (hasAnnotationSignal(annotation)) {
      annotations.push(annotation);
    }
  }

  return annotations;
}

function shiftAnnotations(annotations: TextAnnotation[], offset: number): TextAnnotation[] {
  if (offset === 0) {
    return annotations;
  }
  return annotations.map((annotation) => ({
    ...annotation,
    startOffset: annotation.startOffset + offset,
    endOffset: annotation.endOffset + offset
  }));
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  return values.map((value) => normalizeText(value ?? '')).find(Boolean);
}

function readYoutubeVideoId(root: Element): string | undefined {
  const raw = root.getAttribute('data-attrs');
  if (!raw) {
    return undefined;
  }

  try {
    const attrs = JSON.parse(raw) as { videoId?: string };
    return normalizeText(attrs.videoId ?? '') || undefined;
  } catch {
    return undefined;
  }
}

function findBackgroundImageUrl(root: Element, baseUrl: string): string | undefined {
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[style*="background-image"]'))) {
    const style = element.getAttribute('style') ?? '';
    const match = /background-image\s*:\s*url\((['"]?)(.*?)\1\)/i.exec(style);
    const href = safeUrl(match?.[2], baseUrl);
    if (href) {
      return href;
    }
  }
  return undefined;
}

function readVideoAspectRatio(root: Element, video: Element): number | undefined {
  const preservedAspectRatio = Number(root.getAttribute('data-linelens-media-aspect-ratio') ?? '');
  if (Number.isFinite(preservedAspectRatio) && preservedAspectRatio > 0) {
    return Math.round(preservedAspectRatio * 10000) / 10000;
  }

  const width = Number(video.getAttribute('width') ?? '');
  const height = Number(video.getAttribute('height') ?? '');
  const intrinsicRatio = toValidAspectRatio(width, height);
  if (intrinsicRatio) {
    return intrinsicRatio;
  }

  const ratioContainer = video.closest('[style*="padding-bottom"]') ?? root.querySelector('[style*="padding-bottom"]');
  const paddingBottom = ratioContainer?.getAttribute('style')?.match(/padding-bottom\s*:\s*([0-9.]+)%/i)?.[1];
  const percent = Number(paddingBottom ?? '');
  if (!Number.isFinite(percent) || percent <= 0) {
    return undefined;
  }

  return Math.round((100 / percent) * 10000) / 10000;
}

function toValidAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return Math.round((width / height) * 10000) / 10000;
}

function normalizePreload(value: string | null): VideoBlock['preload'] {
  if (value === 'auto' || value === 'metadata' || value === 'none' || value === '') {
    return value;
  }
  return 'metadata';
}

function findTextOffset(fullText: string, text: string, searchCursor: number): number {
  const sequentialOffset = fullText.indexOf(text, searchCursor);
  if (sequentialOffset >= 0) {
    return sequentialOffset;
  }
  return fullText.indexOf(text);
}

function isBoldElement(element: Element): boolean {
  const fontWeight = getInlineStyleValue(element, 'font-weight');
  return Boolean(element.closest('strong, b') || fontWeight === 'bold' || Number(fontWeight) >= 600);
}

function isItalicElement(element: Element): boolean {
  return Boolean(element.closest('em, i') || getInlineStyleValue(element, 'font-style') === 'italic');
}

function isUnderlineElement(element: Element): boolean {
  return Boolean(element.closest('u') || getInlineStyleValue(element, 'text-decoration')?.includes('underline'));
}

function extractElementTextStyle(element: Element | null): TextStyle {
  return compactStyle({
    color: getInlineStyleValue(element, 'color'),
    fontSize: getInlineStyleValue(element, 'font-size'),
    lineHeight: getInlineStyleValue(element, 'line-height'),
    textAlign: getInlineStyleValue(element, 'text-align'),
    fontStyle: getInlineStyleValue(element, 'font-style'),
    fontWeight: getInlineStyleValue(element, 'font-weight')
  });
}

function extractInlineTextStyle(element: Element): Pick<TextAnnotation, 'color' | 'fontSize' | 'lineHeight' | 'textAlign' | 'fontStyle' | 'textDecoration'> {
  return compactStyle({
    color: getInlineStyleValue(element, 'color'),
    fontSize: getInlineStyleValue(element, 'font-size'),
    lineHeight: getInlineStyleValue(element, 'line-height'),
    textAlign: getInlineStyleValue(element, 'text-align'),
    fontStyle: getInlineStyleValue(element, 'font-style'),
    textDecoration: getInlineStyleValue(element, 'text-decoration')
  });
}

function getInlineStyleValue(element: Element | null, propertyName: string): string | undefined {
  const style = element?.getAttribute('style');
  if (!style) {
    return undefined;
  }

  const normalizedProperty = propertyName.toLowerCase();
  for (const declaration of style.split(';')) {
    const [property, ...rawValue] = declaration.split(':');
    if (property?.trim().toLowerCase() === normalizedProperty) {
      const value = rawValue.join(':').trim();
      return value || undefined;
    }
  }
  return undefined;
}

function compactStyle<T extends Record<string, unknown>>(style: T): T {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined && value !== '')) as T;
}

function hasAnnotationSignal(annotation: TextAnnotation): boolean {
  return Boolean(
    annotation.bold ||
      annotation.href ||
      annotation.color ||
      annotation.fontSize ||
      annotation.lineHeight ||
      annotation.textAlign ||
      annotation.fontStyle ||
      annotation.textDecoration
  );
}

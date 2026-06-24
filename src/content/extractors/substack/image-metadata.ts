import type { ImageBlock } from '../../../shared/article.js';

export function extractSubstackImageUrlMetadata(src: string): Pick<ImageBlock, 'aspectRatio' | 'objectFit' | 'objectPosition'> {
  const decoded = decodeURIComponent(src);
  const width = getUrlDimension(decoded, 'w');
  const height = getUrlDimension(decoded, 'h');
  const cropMode = getUrlToken(decoded, 'c');
  const gravity = getUrlToken(decoded, 'g');
  return {
    ...(toValidAspectRatio(width, height) ? { aspectRatio: toValidAspectRatio(width, height) } : {}),
    ...(cropMode === 'fill' ? { objectFit: 'cover' as const } : {}),
    ...(cropMode === 'limit' ? { objectFit: 'contain' as const } : {}),
    ...(gravity === 'auto' ? { objectPosition: 'center center' } : {})
  };
}

function getUrlDimension(src: string, key: 'w' | 'h'): number {
  const match = new RegExp(`(?:^|[,/])${key}_(\\d+)`).exec(src);
  const value = Number(match?.[1] ?? '');
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getUrlToken(src: string, key: string): string {
  return new RegExp(`(?:^|[,/])${key}_([a-z]+)`, 'i').exec(src)?.[1]?.toLowerCase() ?? '';
}

function toValidAspectRatio(width: number, height: number): number | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const aspectRatio = width / height;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return undefined;
  }

  return Math.round(aspectRatio * 10000) / 10000;
}

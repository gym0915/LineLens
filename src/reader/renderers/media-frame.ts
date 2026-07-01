export type MediaFrameOptions = {
  src: string;
  displaySrc?: string;
  alt?: string;
  backgroundColor?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  visualBleedScale?: number;
  visualBleedMode?: 'always' | 'alpha-transparent';
  imageClassName: string;
  onError?: () => void;
};

export function renderMediaFrame(options: MediaFrameOptions): HTMLElement {
  const frame = document.createElement('span');
  frame.className = 'reader-media-frame';
  if (options.backgroundColor) {
    frame.style.backgroundColor = options.backgroundColor;
  }

  const background = document.createElement('span');
  background.className = 'reader-media-background';
  background.style.backgroundImage = `url("${options.displaySrc ?? options.src}")`;
  background.style.backgroundSize = options.backgroundSize ?? options.objectFit ?? 'cover';
  background.style.backgroundPosition = options.backgroundPosition ?? options.objectPosition ?? 'center center';
  if (isValidVisualBleedScale(options.visualBleedScale)) {
    background.dataset.visualBleedScale = String(options.visualBleedScale);
    background.dataset.visualBleedMode = options.visualBleedMode ?? 'always';
    if (options.visualBleedMode === 'alpha-transparent') {
      probeTransparentVisualBleed(background, options.displaySrc ?? options.src, options.visualBleedScale);
    } else {
      applyVisualBleedScale(background, options.visualBleedScale);
    }
  }
  background.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.className = options.imageClassName;
  image.src = options.src;
  image.alt = options.alt ?? '';
  image.loading = 'lazy';
  image.style.objectFit = options.objectFit ?? options.backgroundSize ?? 'cover';
  image.style.objectPosition = options.objectPosition ?? options.backgroundPosition ?? 'center center';
  if (options.onError) {
    image.addEventListener('error', options.onError);
  }

  frame.append(background, image);
  return frame;
}

function isValidVisualBleedScale(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value !== 1;
}

function applyVisualBleedScale(element: HTMLElement, scale: number): void {
  element.style.transform = `scale(${scale})`;
}

function probeTransparentVisualBleed(element: HTMLElement, src: string, scale: number): void {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.onload = () => {
    if (hasTransparentEdgePixels(image)) {
      applyVisualBleedScale(element, scale);
    }
  };
  image.src = src;
}

function hasTransparentEdgePixels(image: HTMLImageElement): boolean {
  const canvas = document.createElement('canvas');
  const width = Math.min(image.naturalWidth || image.width, 96);
  const height = Math.min(image.naturalHeight || image.height, 96);
  if (width <= 0 || height <= 0) {
    return false;
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return false;
  }

  try {
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return hasTransparentPixelsOnSampledEdges(data, width, height);
  } catch {
    return false;
  }
}

function hasTransparentPixelsOnSampledEdges(data: Uint8ClampedArray, width: number, height: number): boolean {
  const alphaThreshold = 250;
  const edgeDepth = Math.max(1, Math.ceil(Math.min(width, height) * 0.08));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isEdge = x < edgeDepth || y < edgeDepth || x >= width - edgeDepth || y >= height - edgeDepth;
      if (!isEdge) {
        continue;
      }
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < alphaThreshold) {
        return true;
      }
    }
  }
  return false;
}

export function applyMediaAspectRatio(element: HTMLElement, aspectRatio?: number): void {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return;
  }

  const value = String(aspectRatio);
  element.dataset.aspectRatio = value;
  element.setAttribute('style', `--reader-media-aspect-ratio: ${value};`);
}

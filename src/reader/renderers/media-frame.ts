export type MediaFrameOptions = {
  src: string;
  displaySrc?: string;
  alt?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  imageClassName: string;
  onError?: () => void;
};

export function renderMediaFrame(options: MediaFrameOptions): HTMLElement {
  const frame = document.createElement('span');
  frame.className = 'reader-media-frame';

  const background = document.createElement('span');
  background.className = 'reader-media-background';
  background.style.backgroundImage = `url("${options.displaySrc ?? options.src}")`;
  background.style.backgroundSize = options.backgroundSize ?? options.objectFit ?? 'cover';
  background.style.backgroundPosition = options.backgroundPosition ?? options.objectPosition ?? 'center center';
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

export function applyMediaAspectRatio(element: HTMLElement, aspectRatio?: number): void {
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return;
  }

  const value = String(aspectRatio);
  element.dataset.aspectRatio = value;
  element.setAttribute('style', `--reader-media-aspect-ratio: ${value};`);
}

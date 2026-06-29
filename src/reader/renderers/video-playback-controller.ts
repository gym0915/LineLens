export function attachVisibilityControlledPlayback(
  container: HTMLElement,
  video: HTMLVideoElement,
  activate: () => () => void
): () => void {
  let hasActivated = false;
  let teardownPlayback: (() => void) | null = null;
  let wasPlayingBeforeOcclusion = video.autoplay;
  let visibilityPauseInProgress = false;
  let isMostlyVisible = false;

  const activateOnce = () => {
    if (hasActivated) {
      return;
    }
    hasActivated = true;
    teardownPlayback = activate();
  };

  const pauseForOcclusion = () => {
    if (!hasActivated) {
      return;
    }
    wasPlayingBeforeOcclusion = !video.paused;
    if (!video.paused) {
      visibilityPauseInProgress = true;
      video.pause();
      queueMicrotask(() => {
        visibilityPauseInProgress = false;
      });
    }
  };

  const resumeIfNeeded = () => {
    activateOnce();
    if (wasPlayingBeforeOcclusion) {
      void video.play().catch(() => undefined);
    }
  };

  const forcePlay = () => {
    activateOnce();
    wasPlayingBeforeOcclusion = true;
    void video.play().catch(() => undefined);
  };

  const isHighlighted = () => Boolean(container.classList.contains('is-active') || container.closest('.focus-unit.is-active'));
  const playIfHighlightedAndVisible = () => {
    if (isMostlyVisible && isHighlighted()) {
      forcePlay();
    }
  };

  const handlePlay = () => {
    if (!visibilityPauseInProgress) {
      wasPlayingBeforeOcclusion = true;
    }
  };
  const handlePause = () => {
    if (!visibilityPauseInProgress) {
      wasPlayingBeforeOcclusion = false;
    }
  };
  video.addEventListener('play', handlePlay);
  video.addEventListener('pause', handlePause);

  if (!('IntersectionObserver' in window)) {
    forcePlay();
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      teardownPlayback?.();
    };
  }

  const observeRoot = document.body ?? document.documentElement ?? container;
  const highlightObserver = new MutationObserver(() => {
    playIfHighlightedAndVisible();
  });
  highlightObserver.observe(observeRoot, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true
  });
  playIfHighlightedAndVisible();

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      isMostlyVisible = entry.intersectionRatio > 0.2;
      if (!isMostlyVisible) {
        pauseForOcclusion();
        return;
      }

      resumeIfNeeded();
      playIfHighlightedAndVisible();
    },
    {
      threshold: [0, 0.2, 1]
    }
  );
  observer.observe(container);

  return () => {
    observer.disconnect();
    highlightObserver.disconnect();
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    teardownPlayback?.();
  };
}

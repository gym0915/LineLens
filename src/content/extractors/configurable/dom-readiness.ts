export async function waitForStableDom(root: Element, stableDomMs: number): Promise<boolean> {
  if (!Number.isFinite(stableDomMs) || stableDomMs <= 0) {
    return true;
  }

  const view = root.ownerDocument?.defaultView;
  let changed = false;
  const observer =
    typeof view?.MutationObserver === 'function'
      ? new view.MutationObserver(() => {
          changed = true;
        })
      : null;
  const before = observer ? '' : snapshotRoot(root);

  observer?.observe(root, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  });

  await delay(view, stableDomMs);
  observer?.disconnect();

  if (!observer) {
    return before === snapshotRoot(root);
  }

  return !changed;
}

function delay(view: Window | null | undefined, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const setTimer = view?.setTimeout?.bind(view) ?? globalThis.setTimeout;
    setTimer(resolve, ms);
  });
}

function snapshotRoot(root: Element): string {
  return `${root.textContent ?? ''}\n${root.childElementCount}\n${root.getAttributeNames().map((name) => `${name}=${root.getAttribute(name) ?? ''}`).join('|')}`;
}

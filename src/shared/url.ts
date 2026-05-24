const X_ARTICLE_HOSTS = new Set(['x.com', 'twitter.com']);
const X_ARTICLE_PATH_PATTERN = /^\/([^/]+)\/article\/(\d+)\/?$/;

export function isXArticleUrl(value: string | URL): boolean {
  const url = toUrl(value);
  return url !== null && X_ARTICLE_HOSTS.has(url.hostname) && X_ARTICLE_PATH_PATTERN.test(url.pathname);
}

export function getXArticleIdFromUrl(value: string | URL): string | null {
  const url = toUrl(value);
  if (!url || !X_ARTICLE_HOSTS.has(url.hostname)) {
    return null;
  }

  return X_ARTICLE_PATH_PATTERN.exec(url.pathname)?.[2] ?? null;
}

export function getXArticleAuthorHandleFromUrl(value: string | URL): string | undefined {
  const url = toUrl(value);
  if (!url || !X_ARTICLE_HOSTS.has(url.hostname)) {
    return undefined;
  }

  return X_ARTICLE_PATH_PATTERN.exec(url.pathname)?.[1];
}

function toUrl(value: string | URL): URL | null {
  if (value instanceof URL) {
    return value;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

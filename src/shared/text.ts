export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizePreWrapText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeCodeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');
}

export function hasMeaningfulText(value: string): boolean {
  return normalizeText(value).length > 0;
}

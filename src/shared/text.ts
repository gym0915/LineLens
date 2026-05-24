export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function hasMeaningfulText(value: string): boolean {
  return normalizeText(value).length > 0;
}

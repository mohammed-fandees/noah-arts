/** "Aiko, Keynes & me" → "aiko-keynes-me". Falls back to "drawing" for titles with no letters. */
export function slugify(text: string, fallback = 'drawing'): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** Picks `base`, or `base-2`, `base-3`… — the first one `taken` says is free. */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
}

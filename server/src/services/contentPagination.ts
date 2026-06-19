export function normalizeNextContentUrls(values: unknown[], baseUrl: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    let absolute = raw;
    try {
      absolute = new URL(raw, baseUrl).href;
    } catch {
      continue;
    }
    if (absolute === baseUrl || seen.has(absolute)) continue;
    seen.add(absolute);
    result.push(absolute);
  }
  return result;
}

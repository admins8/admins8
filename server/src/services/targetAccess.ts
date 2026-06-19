import { buildHeaders, httpRequest, UrlOption } from './bookSourceHttpClient';

export type TargetAccessMode = 'direct' | 'snapshot-fallback' | 'snapshot-first';

export interface TargetAccessOption extends UrlOption {
  targetAccessMode?: TargetAccessMode;
}

const JINA_SUPPORTED_HOST_PATTERNS = [
  /(^|\.)ipaoshuba\.net$/i,
  /(^|\.)paoshuba\.com$/i,
  /(^|\.)paoshu8\.com$/i,
];

export function buildJinaMarkdownSnapshotUrl(url: string): string {
  return `https://r.jina.ai/http://r.jina.ai/http://${url}`;
}

export function shouldUseJinaSnapshot(url: string, option: Pick<TargetAccessOption, 'method'> = {}): boolean {
  if (String(option.method || 'GET').toUpperCase() !== 'GET') return false;
  try {
    const host = new URL(url).hostname;
    return JINA_SUPPORTED_HOST_PATTERNS.some(pattern => pattern.test(host));
  } catch {
    return false;
  }
}

export function buildTargetAccessAttempts(url: string, option: TargetAccessOption = {}): string[] {
  const mode = option.targetAccessMode || 'direct';
  if (mode === 'direct' || !shouldUseJinaSnapshot(url, option)) return [url];
  const snapshotUrl = buildJinaMarkdownSnapshotUrl(url);
  if (mode === 'snapshot-first') return [snapshotUrl, url];
  return [url, snapshotUrl];
}

export function isJinaMarkdownSnapshot(html: string): boolean {
  return /URL Source:\s*https?:\/\/[^\n]+/i.test(String(html || '')) && String(html || '').includes('Markdown Content:');
}

export function jinaMarkdownContent(html: string): string {
  const raw = String(html || '');
  const index = raw.indexOf('Markdown Content:');
  return index >= 0 ? raw.slice(index + 'Markdown Content:'.length).trim() : raw.trim();
}

export function normalizeJinaMarkdownText(value: string): string {
  return String(value || '')
    .replace(/\\\*/g, '*')
    .replace(/[*_`]+/g, '')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractJinaMarkdownLinks(html: string): Array<{ title: string; url: string }> {
  const markdown = jinaMarkdownContent(html);
  const results: Array<{ title: string; url: string }> = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(markdown))) {
    const title = normalizeJinaMarkdownText(match[1]);
    const url = String(match[2] || '').trim();
    if (title && url) results.push({ title, url });
  }
  return results;
}

export function extractJinaMarkdownText(html: string): string {
  return normalizeJinaMarkdownText(
    jinaMarkdownContent(html)
      .replace(/^Title:.*$/gm, '')
      .replace(/^URL Source:.*$/gm, '')
      .replace(/^#+\s+.*$/gm, '')
  );
}

export async function requestTargetHtml(url: string, headers: Record<string, string>, option: TargetAccessOption = {}): Promise<string> {
  const attempts = buildTargetAccessAttempts(url, option);
  let lastError: any;
  for (const attemptUrl of attempts) {
    try {
      return await httpRequest(attemptUrl, attemptUrl === url ? headers : buildHeaders(''), {
        ...option,
        targetAccessMode: 'direct',
        charset: attemptUrl === url ? option.charset : 'utf-8',
        timeoutMs: attemptUrl === url ? option.timeoutMs : Math.max(option.timeoutMs || 0, 30000),
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

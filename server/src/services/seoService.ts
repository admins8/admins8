import { query } from '../config/database';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

const PINYIN_MAP: Record<string, string> = {
  赤: 'chi', 心: 'xin', 巡: 'xun', 天: 'tian',
  情: 'qing', 何: 'he', 以: 'yi', 甚: 'shen',
  青: 'qing', 山: 'shan', 会: 'hui', 说: 'shuo', 话: 'hua', 的: 'de', 肘: 'zhou', 子: 'zi',
};

function trimDomain(domain: string): string {
  return String(domain || '').trim().replace(/\/+$/, '') || 'https://soumal.com';
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(value: string): string {
  const parts: string[] = [];
  for (const char of String(value || '')) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      parts.push(PINYIN_MAP[char] || char.charCodeAt(0).toString(36));
    } else {
      parts.push(char);
    }
  }
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'book';
}

export function buildSeoBookSlug(book: { id?: number | string; name?: string; author?: string }): string {
  const id = String(book.id || '').trim();
  const name = slugify(book.name || '');
  const author = slugify(book.author || '');
  return [id, name, author].filter(Boolean).join('-');
}

export function buildSeoBookUrl(domain: string, book: { id?: number | string; name?: string; author?: string }): string {
  return `${trimDomain(domain)}/book/${buildSeoBookSlug(book)}.html`;
}

export function buildRobotsTxt(domain: string): string {
  const site = trimDomain(domain);
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /profile',
    'Disallow: /sources',
    'Disallow: /read/',
    'Disallow: /book/search',
    'Disallow: /*?*',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');
}

export function buildSitemapXml(urls: SitemapUrl[]): string {
  const body = urls.map((item) => {
    const lines = [
      '  <url>',
      `    <loc>${escapeXml(item.loc)}</loc>`,
    ];
    if (item.lastmod) lines.push(`    <lastmod>${escapeXml(item.lastmod)}</lastmod>`);
    if (item.changefreq) lines.push(`    <changefreq>${item.changefreq}</changefreq>`);
    if (typeof item.priority === 'number') lines.push(`    <priority>${Math.max(0, Math.min(1, item.priority)).toFixed(1)}</priority>`);
    lines.push('  </url>');
    return lines.join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export async function getSeoDomain(): Promise<string> {
  const row = await query('SELECT config_value FROM site_config WHERE config_key=? LIMIT 1', ['web_domain']).then(rows => rows[0]).catch(() => null);
  return trimDomain(row?.config_value || process.env.SITE_URL || 'https://soumal.com');
}

export async function collectSitemapUrls(domain?: string, limit = 1000): Promise<SitemapUrl[]> {
  const site = trimDomain(domain || await getSeoDomain());
  const urls: SitemapUrl[] = [
    { loc: `${site}/`, changefreq: 'daily', priority: 1 },
    { loc: `${site}/ranking`, changefreq: 'daily', priority: 0.8 },
    { loc: `${site}/girls`, changefreq: 'daily', priority: 0.7 },
    { loc: `${site}/library`, changefreq: 'daily', priority: 0.8 },
    { loc: `${site}/about`, changefreq: 'monthly', priority: 0.3 },
    { loc: `${site}/contact`, changefreq: 'monthly', priority: 0.3 },
    { loc: `${site}/privacy`, changefreq: 'yearly', priority: 0.2 },
    { loc: `${site}/agreement`, changefreq: 'yearly', priority: 0.2 },
  ];
  const books = await query(
    `SELECT id, name, author, updated_at FROM books
     WHERE name <> '' ORDER BY updated_at DESC, id DESC LIMIT ?`,
    [Math.max(1, Math.min(50000, limit))]
  ).catch(() => []);
  for (const book of books) {
    urls.push({
      loc: buildSeoBookUrl(site, book),
      lastmod: book.updated_at ? new Date(book.updated_at).toISOString().slice(0, 10) : undefined,
      changefreq: 'daily',
      priority: 0.8,
    });
  }
  const tags = await query('SELECT name, updated_at FROM hot_tags WHERE is_active=1 ORDER BY sort_order ASC, id ASC LIMIT 200').catch(() => []);
  for (const tag of tags) {
    urls.push({
      loc: `${site}/tag/${encodeURIComponent(tag.name)}.html`,
      lastmod: tag.updated_at ? new Date(tag.updated_at).toISOString().slice(0, 10) : undefined,
      changefreq: 'weekly',
      priority: 0.6,
    });
  }
  return urls;
}

import { execute, query, queryOne } from '../config/database';
import { getAllSiteConfigs, upsertSiteConfig } from '../repositories/siteConfigRepository';

export interface FriendlyLinkRow {
  id: number
  name: string
  url: string
  description?: string | null
  sort_order: number
  is_active: number
  start_at?: string | Date | null
  end_at?: string | Date | null
}

function boolToTinyInt(value: unknown): number {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

function normalizeDate(value: unknown): string | null {
  const raw = String(value || '').trim();
  return raw ? raw : null;
}

export function normalizeFriendlyLinkPayload(payload: any) {
  return {
    name: String(payload?.name || '').trim(),
    url: String(payload?.url || '').trim(),
    description: String(payload?.description || '').trim(),
    sort_order: Number.parseInt(String(payload?.sort_order ?? 0), 10) || 0,
    is_active: boolToTinyInt(payload?.is_active ?? 1),
    start_at: normalizeDate(payload?.start_at),
    end_at: normalizeDate(payload?.end_at),
  };
}

function toTime(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function filterVisibleFriendlyLinks<T extends FriendlyLinkRow>(
  links: T[],
  enabled: boolean,
  now = new Date()
): T[] {
  if (!enabled) return [];
  const current = now.getTime();
  return links.filter((link) => {
    if (Number(link.is_active) !== 1) return false;
    const start = toTime(link.start_at);
    const end = toTime(link.end_at);
    if (start !== null && current < start) return false;
    if (end !== null && current > end) return false;
    return true;
  });
}

async function isFriendlyLinksEnabled(): Promise<boolean> {
  const configs = await getAllSiteConfigs();
  const item = configs.find(c => c.config_key === 'friendly_links_enabled');
  return item?.config_value !== 'false';
}

export async function listFriendlyLinks() {
  return query('SELECT * FROM friendly_links ORDER BY sort_order ASC, id ASC');
}

export async function getPublicFriendlyLinks() {
  const [links, enabled] = await Promise.all([listFriendlyLinks(), isFriendlyLinksEnabled()]);
  return filterVisibleFriendlyLinks(links as FriendlyLinkRow[], enabled);
}

export async function getFriendlyLinkSettings() {
  return { enabled: await isFriendlyLinksEnabled() };
}

export async function updateFriendlyLinkSettings(enabled: boolean) {
  await upsertSiteConfig('friendly_links_enabled', enabled ? 'true' : 'false');
  return getFriendlyLinkSettings();
}

export async function createFriendlyLink(payload: any) {
  const data = normalizeFriendlyLinkPayload(payload);
  if (!data.name) throw new Error('站点名称不能为空');
  if (!data.url) throw new Error('链接地址不能为空');
  const result: any = await execute(
    `INSERT INTO friendly_links (name, url, description, sort_order, is_active, start_at, end_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.name, data.url, data.description, data.sort_order, data.is_active, data.start_at, data.end_at]
  );
  return queryOne('SELECT * FROM friendly_links WHERE id = ?', [result.insertId]);
}

export async function updateFriendlyLink(id: number, payload: any) {
  const data = normalizeFriendlyLinkPayload(payload);
  if (!data.name) throw new Error('站点名称不能为空');
  if (!data.url) throw new Error('链接地址不能为空');
  await execute(
    `UPDATE friendly_links
     SET name = ?, url = ?, description = ?, sort_order = ?, is_active = ?, start_at = ?, end_at = ?, updated_at = NOW()
     WHERE id = ?`,
    [data.name, data.url, data.description, data.sort_order, data.is_active, data.start_at, data.end_at, id]
  );
  return queryOne('SELECT * FROM friendly_links WHERE id = ?', [id]);
}

export async function deleteFriendlyLink(id: number) {
  await execute('DELETE FROM friendly_links WHERE id = ?', [id]);
  return true;
}

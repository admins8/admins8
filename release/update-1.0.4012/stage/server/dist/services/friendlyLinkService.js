"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeFriendlyLinkPayload = normalizeFriendlyLinkPayload;
exports.filterVisibleFriendlyLinks = filterVisibleFriendlyLinks;
exports.listFriendlyLinks = listFriendlyLinks;
exports.getPublicFriendlyLinks = getPublicFriendlyLinks;
exports.getFriendlyLinkSettings = getFriendlyLinkSettings;
exports.updateFriendlyLinkSettings = updateFriendlyLinkSettings;
exports.createFriendlyLink = createFriendlyLink;
exports.updateFriendlyLink = updateFriendlyLink;
exports.deleteFriendlyLink = deleteFriendlyLink;
const database_1 = require("../config/database");
const siteConfigRepository_1 = require("../repositories/siteConfigRepository");
function boolToTinyInt(value) {
    return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}
function normalizeDate(value) {
    const raw = String(value || '').trim();
    return raw ? raw : null;
}
function normalizeFriendlyLinkPayload(payload) {
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
function toTime(value) {
    if (!value)
        return null;
    const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
}
function filterVisibleFriendlyLinks(links, enabled, now = new Date()) {
    if (!enabled)
        return [];
    const current = now.getTime();
    return links.filter((link) => {
        if (Number(link.is_active) !== 1)
            return false;
        const start = toTime(link.start_at);
        const end = toTime(link.end_at);
        if (start !== null && current < start)
            return false;
        if (end !== null && current > end)
            return false;
        return true;
    });
}
async function isFriendlyLinksEnabled() {
    const configs = await (0, siteConfigRepository_1.getAllSiteConfigs)();
    const item = configs.find(c => c.config_key === 'friendly_links_enabled');
    return item?.config_value !== 'false';
}
async function listFriendlyLinks() {
    return (0, database_1.query)('SELECT * FROM friendly_links ORDER BY sort_order ASC, id ASC');
}
async function getPublicFriendlyLinks() {
    const [links, enabled] = await Promise.all([listFriendlyLinks(), isFriendlyLinksEnabled()]);
    return filterVisibleFriendlyLinks(links, enabled);
}
async function getFriendlyLinkSettings() {
    return { enabled: await isFriendlyLinksEnabled() };
}
async function updateFriendlyLinkSettings(enabled) {
    await (0, siteConfigRepository_1.upsertSiteConfig)('friendly_links_enabled', enabled ? 'true' : 'false');
    return getFriendlyLinkSettings();
}
async function createFriendlyLink(payload) {
    const data = normalizeFriendlyLinkPayload(payload);
    if (!data.name)
        throw new Error('站点名称不能为空');
    if (!data.url)
        throw new Error('链接地址不能为空');
    const result = await (0, database_1.execute)(`INSERT INTO friendly_links (name, url, description, sort_order, is_active, start_at, end_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [data.name, data.url, data.description, data.sort_order, data.is_active, data.start_at, data.end_at]);
    return (0, database_1.queryOne)('SELECT * FROM friendly_links WHERE id = ?', [result.insertId]);
}
async function updateFriendlyLink(id, payload) {
    const data = normalizeFriendlyLinkPayload(payload);
    if (!data.name)
        throw new Error('站点名称不能为空');
    if (!data.url)
        throw new Error('链接地址不能为空');
    await (0, database_1.execute)(`UPDATE friendly_links
     SET name = ?, url = ?, description = ?, sort_order = ?, is_active = ?, start_at = ?, end_at = ?, updated_at = NOW()
     WHERE id = ?`, [data.name, data.url, data.description, data.sort_order, data.is_active, data.start_at, data.end_at, id]);
    return (0, database_1.queryOne)('SELECT * FROM friendly_links WHERE id = ?', [id]);
}
async function deleteFriendlyLink(id) {
    await (0, database_1.execute)('DELETE FROM friendly_links WHERE id = ?', [id]);
    return true;
}
//# sourceMappingURL=friendlyLinkService.js.map
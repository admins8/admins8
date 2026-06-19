"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRssSources = getRssSources;
exports.importRssSourceUrl = importRssSourceUrl;
exports.putRssSource = putRssSource;
exports.removeRssSources = removeRssSources;
exports.getRssArticles = getRssArticles;
exports.getRssContent = getRssContent;
const rssSourceService_1 = require("../services/rssSourceService");
async function getRssSources(_req, res) {
    try {
        res.json({ code: 0, data: await (0, rssSourceService_1.listRssSources)() });
    }
    catch (err) {
        res.status(500).json({ code: 500, msg: err.message || '获取订阅源失败' });
    }
}
async function importRssSourceUrl(req, res) {
    try {
        const { url } = req.body || {};
        if (!url || typeof url !== 'string') {
            res.status(400).json({ code: 400, msg: '请输入订阅源链接' });
            return;
        }
        const result = await (0, rssSourceService_1.importRssSourcesFromUrl)(url);
        res.json({
            code: 0,
            msg: `订阅源导入完成：成功 ${result.success} 个，失败 ${result.fail} 个`,
            data: result,
        });
    }
    catch (err) {
        res.status(400).json({ code: 400, msg: err.message || '订阅源导入失败' });
    }
}
async function putRssSource(req, res) {
    try {
        await (0, rssSourceService_1.updateRssSource)(Number(req.params.id), req.body || {});
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.status(500).json({ code: 500, msg: err.message || '更新订阅源失败' });
    }
}
async function removeRssSources(req, res) {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.body?.ids];
        const idList = ids.map(Number).filter((id) => Number.isFinite(id) && id > 0);
        await (0, rssSourceService_1.deleteRssSources)(idList);
        res.json({ code: 0, msg: `已删除 ${idList.length} 个订阅源` });
    }
    catch (err) {
        res.status(500).json({ code: 500, msg: err.message || '删除订阅源失败' });
    }
}
async function getRssArticles(req, res) {
    try {
        const result = await (0, rssSourceService_1.listRssArticles)(Number(req.params.id), String(req.query.url || ''));
        res.json({ code: 0, data: result });
    }
    catch (err) {
        res.status(400).json({ code: 400, msg: err.message || '读取订阅源文章失败' });
    }
}
async function getRssContent(req, res) {
    try {
        const link = String(req.query.link || '');
        if (!link) {
            res.status(400).json({ code: 400, msg: '缺少文章链接' });
            return;
        }
        const result = await (0, rssSourceService_1.getRssArticleContent)(Number(req.params.id), link);
        res.json({ code: 0, data: result });
    }
    catch (err) {
        res.status(400).json({ code: 400, msg: err.message || '读取文章内容失败' });
    }
}
//# sourceMappingURL=rssSourceController.js.map
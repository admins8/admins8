"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicChannelHandler = getPublicChannelHandler;
exports.getAdminChannelHandler = getAdminChannelHandler;
exports.updateChannelHandler = updateChannelHandler;
exports.seedChannelHandler = seedChannelHandler;
exports.createSectionHandler = createSectionHandler;
exports.updateSectionHandler = updateSectionHandler;
exports.deleteSectionHandler = deleteSectionHandler;
exports.createItemHandler = createItemHandler;
exports.updateItemHandler = updateItemHandler;
exports.deleteItemHandler = deleteItemHandler;
exports.getPublicContentPageHandler = getPublicContentPageHandler;
exports.listContentPagesHandler = listContentPagesHandler;
exports.getAdminContentPageHandler = getAdminContentPageHandler;
exports.updateContentPageHandler = updateContentPageHandler;
exports.getPublicFriendlyLinksHandler = getPublicFriendlyLinksHandler;
exports.listFriendlyLinksHandler = listFriendlyLinksHandler;
exports.updateFriendlyLinkSettingsHandler = updateFriendlyLinkSettingsHandler;
exports.createFriendlyLinkHandler = createFriendlyLinkHandler;
exports.updateFriendlyLinkHandler = updateFriendlyLinkHandler;
exports.deleteFriendlyLinkHandler = deleteFriendlyLinkHandler;
const pageChannelService_1 = require("../services/pageChannelService");
const contentPageService_1 = require("../services/contentPageService");
const friendlyLinkService_1 = require("../services/friendlyLinkService");
function ok(res, data, msg = 'ok') {
    res.json({ code: 0, msg, data });
}
function fail(res, status, error) {
    res.status(status).json({ code: status, msg: error?.message || String(error) });
}
function paramString(value) {
    return Array.isArray(value) ? value[0] : String(value || '');
}
async function getPublicChannelHandler(req, res) {
    try {
        const data = await (0, pageChannelService_1.getPublicChannel)(paramString(req.params.code));
        if (!data)
            return fail(res, 404, new Error('频道不存在或未启用'));
        ok(res, data);
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function getAdminChannelHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.getAdminChannel)(paramString(req.params.code)));
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function updateChannelHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.updateChannel)(paramString(req.params.code), req.body), '频道设置已保存');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function seedChannelHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.seedChannel)(paramString(req.params.code)), '频道已初始化');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function createSectionHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.createSection)(paramString(req.params.code), req.body), '区块已创建');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function updateSectionHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.updateSection)(Number(req.params.id), req.body), '区块已保存');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function deleteSectionHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.deleteSection)(Number(req.body.id)), '区块已删除');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function createItemHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.createItem)(Number(req.params.id), req.body), '条目已创建');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function updateItemHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.updateItem)(Number(req.params.id), req.body), '条目已保存');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function deleteItemHandler(req, res) {
    try {
        ok(res, await (0, pageChannelService_1.deleteItem)(Number(req.body.id)), '条目已删除');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function getPublicContentPageHandler(req, res) {
    try {
        const data = await (0, contentPageService_1.getPublicContentPage)(paramString(req.params.slug));
        if (!data)
            return fail(res, 404, new Error('页面不存在或未启用'));
        ok(res, data);
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function listContentPagesHandler(_req, res) {
    try {
        ok(res, await (0, contentPageService_1.listContentPages)());
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function getAdminContentPageHandler(req, res) {
    try {
        const data = await (0, contentPageService_1.getAdminContentPage)(paramString(req.params.slug));
        if (!data)
            return fail(res, 404, new Error('页面不存在'));
        ok(res, data);
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function updateContentPageHandler(req, res) {
    try {
        ok(res, await (0, contentPageService_1.updateContentPage)(paramString(req.params.slug), req.body), '页面已保存');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function getPublicFriendlyLinksHandler(_req, res) {
    try {
        ok(res, await (0, friendlyLinkService_1.getPublicFriendlyLinks)());
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function listFriendlyLinksHandler(_req, res) {
    try {
        const [links, settings] = await Promise.all([(0, friendlyLinkService_1.listFriendlyLinks)(), (0, friendlyLinkService_1.getFriendlyLinkSettings)()]);
        ok(res, { links, settings });
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function updateFriendlyLinkSettingsHandler(req, res) {
    try {
        ok(res, await (0, friendlyLinkService_1.updateFriendlyLinkSettings)(Boolean(req.body?.enabled)), '友情链接设置已保存');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function createFriendlyLinkHandler(req, res) {
    try {
        ok(res, await (0, friendlyLinkService_1.createFriendlyLink)(req.body), '友情链接已创建');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function updateFriendlyLinkHandler(req, res) {
    try {
        ok(res, await (0, friendlyLinkService_1.updateFriendlyLink)(Number(req.params.id), req.body), '友情链接已保存');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
async function deleteFriendlyLinkHandler(req, res) {
    try {
        ok(res, await (0, friendlyLinkService_1.deleteFriendlyLink)(Number(req.body.id)), '友情链接已删除');
    }
    catch (e) {
        fail(res, 500, e);
    }
}
//# sourceMappingURL=pageController.js.map
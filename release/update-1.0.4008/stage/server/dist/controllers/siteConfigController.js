"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllConfigs = getAllConfigs;
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
exports.updateConfigs = updateConfigs;
exports.testEmailConfig = testEmailConfig;
exports.testProxyConfig = testProxyConfig;
const siteConfigRepository_1 = require("../repositories/siteConfigRepository");
const emailConfig_1 = require("../services/emailConfig");
const emailService_1 = require("../services/emailService");
const bookSourceHttpClient_1 = require("../services/bookSourceHttpClient");
const siteConfigPayload_1 = require("../services/siteConfigPayload");
/** 获取所有配置 */
async function getAllConfigs(req, res) {
    try {
        const items = await (0, siteConfigRepository_1.getAllSiteConfigs)();
        res.json({ code: 0, data: (0, emailConfig_1.maskEmailConfig)(items) });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/** 获取单个配置 */
async function getConfig(req, res) {
    try {
        const key = String(req.params.key);
        const item = await (0, siteConfigRepository_1.getSiteConfigByKey)(key);
        if (item) {
            res.json({ code: 0, data: item });
        }
        else {
            res.json({ code: 404, msg: '配置不存在' });
        }
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/** 更新配置 */
async function updateConfig(req, res) {
    try {
        const [{ config_key, config_value }] = (0, siteConfigPayload_1.normalizeSiteConfigPayloads)([req.body]);
        await (0, siteConfigRepository_1.upsertSiteConfig)(config_key, config_value);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/** 批量更新配置 */
async function updateConfigs(req, res) {
    try {
        const configs = Array.isArray(req.body) ? req.body : [];
        const normalizedConfigs = configs.filter((item) => {
            return !(item.config_key === 'smtp_password' && item.config_value === '__CONFIGURED__');
        });
        await (0, siteConfigRepository_1.upsertSiteConfigs)((0, siteConfigPayload_1.normalizeSiteConfigPayloads)(normalizedConfigs));
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
/** 发送测试邮件 */
async function testEmailConfig(req, res) {
    try {
        const { to } = req.body;
        if (!to) {
            res.json({ code: 400, msg: '请输入测试收件邮箱' });
            return;
        }
        await (0, emailService_1.sendTestEmail)(String(to));
        res.json({ code: 0, msg: '测试邮件发送成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message || '测试邮件发送失败' });
    }
}
/** 检测搜索/换源代理是否可用 */
async function testProxyConfig(req, res) {
    try {
        const result = await (0, bookSourceHttpClient_1.testSearchProxyPool)({
            proxy: String(req.body?.proxy || ''),
            userAgents: String(req.body?.userAgents || ''),
        });
        res.json({ code: 0, data: result });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message || '代理检测失败' });
    }
}
//# sourceMappingURL=siteConfigController.js.map
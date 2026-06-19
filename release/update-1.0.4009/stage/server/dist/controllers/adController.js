"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdsByPosition = getAdsByPosition;
exports.getAllAds = getAllAds;
exports.addAd = addAd;
exports.updateAd = updateAd;
exports.deleteAd = deleteAd;
const database_1 = require("../config/database");
const adDefaults_1 = require("../utils/adDefaults");
/**
 * 广告位约定：
 *   home_top      首页顶部
 *   home_middle   首页中部
 *   home_bottom   首页底部
 *   reader_top    阅读页顶部
 *   reader_middle 阅读页章节中
 *   reader_bottom 阅读页底部
 *   reader_popup  阅读页弹窗广告
 */
// ========== 公开接口（前台展示用） ==========
/** 按位置获取启用中的广告（已过滤生效时间） */
async function getAdsByPosition(req, res) {
    try {
        const position = String(req.query.position || '').trim();
        if (!position) {
            res.json({ code: 400, msg: 'position 不能为空' });
            return;
        }
        const items = await (0, database_1.query)(`SELECT id, position, title, image_url, link_url, content, ad_type, target, sort_order,
              popup_interval_seconds, popup_auto_close_seconds
       FROM advertisements
       WHERE is_active = 1
         AND position = ?
         AND (start_time IS NULL OR start_time <= NOW())
         AND (end_time IS NULL OR end_time >= NOW())
       ORDER BY sort_order ASC, id DESC`, [position]);
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
// ========== 管理接口 ==========
/** 获取所有广告（可按 position 过滤） */
async function getAllAds(req, res) {
    try {
        const position = req.query.position ? String(req.query.position) : '';
        let sql = 'SELECT * FROM advertisements';
        const params = [];
        if (position) {
            sql += ' WHERE position = ?';
            params.push(position);
        }
        sql += ' ORDER BY position ASC, sort_order ASC, id DESC';
        const items = await (0, database_1.query)(sql, params);
        res.json({ code: 0, data: items });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function addAd(req, res) {
    try {
        const { position, title, image_url, link_url, content, ad_type, target, sort_order, start_time, end_time, is_active, remark, popup_interval_seconds, popup_auto_close_seconds, } = req.body;
        if (!position) {
            res.json({ code: 400, msg: '广告位置必填' });
            return;
        }
        const popupInterval = (0, adDefaults_1.normalizePopupSeconds)(popup_interval_seconds, adDefaults_1.DEFAULT_POPUP_INTERVAL_SECONDS);
        const popupAutoClose = (0, adDefaults_1.normalizePopupSeconds)(popup_auto_close_seconds, adDefaults_1.DEFAULT_POPUP_AUTO_CLOSE_SECONDS);
        const result = await (0, database_1.execute)(`INSERT INTO advertisements
        (position, title, image_url, link_url, content, ad_type, target, sort_order, start_time, end_time, is_active, remark,
         popup_interval_seconds, popup_auto_close_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            position,
            title || '',
            image_url || '',
            link_url || '',
            content || '',
            ad_type || 'image',
            target || '_blank',
            sort_order || 0,
            start_time || null,
            end_time || null,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            remark || '',
            popupInterval,
            popupAutoClose,
        ]);
        res.json({ code: 0, data: { id: result.insertId } });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function updateAd(req, res) {
    try {
        const { id, position, title, image_url, link_url, content, ad_type, target, sort_order, start_time, end_time, is_active, remark, popup_interval_seconds, popup_auto_close_seconds, } = req.body;
        if (!id) {
            res.json({ code: 400, msg: 'id 必填' });
            return;
        }
        const popupInterval = (0, adDefaults_1.normalizePopupSeconds)(popup_interval_seconds, adDefaults_1.DEFAULT_POPUP_INTERVAL_SECONDS);
        const popupAutoClose = (0, adDefaults_1.normalizePopupSeconds)(popup_auto_close_seconds, adDefaults_1.DEFAULT_POPUP_AUTO_CLOSE_SECONDS);
        await (0, database_1.execute)(`UPDATE advertisements
         SET position = ?, title = ?, image_url = ?, link_url = ?, content = ?,
             ad_type = ?, target = ?, sort_order = ?,
             start_time = ?, end_time = ?, is_active = ?, remark = ?,
             popup_interval_seconds = ?, popup_auto_close_seconds = ?
       WHERE id = ?`, [
            position,
            title || '',
            image_url || '',
            link_url || '',
            content || '',
            ad_type || 'image',
            target || '_blank',
            sort_order || 0,
            start_time || null,
            end_time || null,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            remark || '',
            popupInterval,
            popupAutoClose,
            id,
        ]);
        res.json({ code: 0, msg: '更新成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
async function deleteAd(req, res) {
    try {
        const { id } = req.body;
        if (!id) {
            res.json({ code: 400, msg: 'id 必填' });
            return;
        }
        await (0, database_1.execute)('DELETE FROM advertisements WHERE id = ?', [id]);
        res.json({ code: 0, msg: '删除成功' });
    }
    catch (err) {
        res.json({ code: 500, msg: err.message });
    }
}
//# sourceMappingURL=adController.js.map
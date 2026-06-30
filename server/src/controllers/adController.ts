import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, execute, queryOne } from '../config/database';
import { config } from '../config';
import {
  DEFAULT_POPUP_AUTO_CLOSE_SECONDS,
  DEFAULT_POPUP_INTERVAL_SECONDS,
  normalizePopupSeconds,
} from '../utils/adDefaults';

/** 检查请求用户是否为有效会员 */
async function checkIsMember(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    if (!decoded || !decoded.userId) return false;
    if (decoded.role === 'admin' || decoded.role === 'superadmin') return true;
    const user = await queryOne(
      'SELECT membership_type, membership_expire_at FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!user) return false;
    return user.membership_type !== 'free' && user.membership_expire_at && new Date(user.membership_expire_at) > new Date();
  } catch {
    return false;
  }
}

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

/** 按位置获取启用中的广告（已过滤生效时间，会员免广告） */
export async function getAdsByPosition(req: Request, res: Response): Promise<void> {
  try {
    const position = String(req.query.position || '').trim();
    if (!position) {
      res.json({ code: 400, msg: 'position 不能为空' });
      return;
    }
    // 会员免广告
    const isMember = await checkIsMember(req);
    if (isMember) {
      res.json({ code: 0, data: [] });
      return;
    }
    const items = await query(
      `SELECT id, position, title, image_url, link_url, content, ad_type, target, sort_order,
              popup_interval_seconds, popup_auto_close_seconds
       FROM advertisements
       WHERE is_active = 1
         AND position = ?
         AND (start_time IS NULL OR start_time <= NOW())
         AND (end_time IS NULL OR end_time >= NOW())
       ORDER BY sort_order ASC, id DESC`,
      [position]
    );
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 管理接口 ==========

/** 获取所有广告（可按 position 过滤） */
export async function getAllAds(req: Request, res: Response): Promise<void> {
  try {
    const position = req.query.position ? String(req.query.position) : '';
    let sql = 'SELECT * FROM advertisements';
    const params: any[] = [];
    if (position) {
      sql += ' WHERE position = ?';
      params.push(position);
    }
    sql += ' ORDER BY position ASC, sort_order ASC, id DESC';
    const items = await query(sql, params);
    res.json({ code: 0, data: items });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function addAd(req: Request, res: Response): Promise<void> {
  try {
    const {
      position, title, image_url, link_url, content,
      ad_type, target, sort_order, start_time, end_time, is_active, remark,
      popup_interval_seconds, popup_auto_close_seconds,
    } = req.body;
    if (!position) {
      res.json({ code: 400, msg: '广告位置必填' });
      return;
    }
    const popupInterval = normalizePopupSeconds(popup_interval_seconds, DEFAULT_POPUP_INTERVAL_SECONDS);
    const popupAutoClose = normalizePopupSeconds(popup_auto_close_seconds, DEFAULT_POPUP_AUTO_CLOSE_SECONDS);
    const result = await execute(
      `INSERT INTO advertisements
        (position, title, image_url, link_url, content, ad_type, target, sort_order, start_time, end_time, is_active, remark,
         popup_interval_seconds, popup_auto_close_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
      ]
    );
    res.json({ code: 0, data: { id: result.insertId } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function updateAd(req: Request, res: Response): Promise<void> {
  try {
    const {
      id, position, title, image_url, link_url, content,
      ad_type, target, sort_order, start_time, end_time, is_active, remark,
      popup_interval_seconds, popup_auto_close_seconds,
    } = req.body;
    if (!id) {
      res.json({ code: 400, msg: 'id 必填' });
      return;
    }
    const popupInterval = normalizePopupSeconds(popup_interval_seconds, DEFAULT_POPUP_INTERVAL_SECONDS);
    const popupAutoClose = normalizePopupSeconds(popup_auto_close_seconds, DEFAULT_POPUP_AUTO_CLOSE_SECONDS);
    await execute(
      `UPDATE advertisements
         SET position = ?, title = ?, image_url = ?, link_url = ?, content = ?,
             ad_type = ?, target = ?, sort_order = ?,
             start_time = ?, end_time = ?, is_active = ?, remark = ?,
             popup_interval_seconds = ?, popup_auto_close_seconds = ?
       WHERE id = ?`,
      [
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
      ]
    );
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function deleteAd(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    if (!id) {
      res.json({ code: 400, msg: 'id 必填' });
      return;
    }
    await execute('DELETE FROM advertisements WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

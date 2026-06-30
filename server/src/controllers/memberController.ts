import { Request, Response } from 'express';
import { query, queryOne, execute } from '../config/database';
import crypto from 'crypto';

function generateOrderNo(): string {
  return 'M' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

// 获取会员配置列表
export async function getMembershipConfigs(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(
      'SELECT id, product_type, name, price, sale_price, duration_days, badge_icon, badge_color, description, is_active, sort_order, created_at, updated_at FROM membership_config ORDER BY sort_order ASC'
    );
    res.json({ code: 0, data: rows });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 创建会员配置
export async function createMembershipConfig(req: Request, res: Response): Promise<void> {
  try {
    const { product_type, name, price, sale_price, duration_days, badge_icon, badge_color, description, sort_order } = req.body;
    if (!product_type || !name || price === undefined || sale_price === undefined || !duration_days) {
      res.json({ code: 400, msg: '请填写完整的会员配置信息' });
      return;
    }
    await execute(
      'INSERT INTO membership_config (product_type, name, price, sale_price, duration_days, badge_icon, badge_color, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [product_type, name, price, sale_price, duration_days, badge_icon || '', badge_color || '#FFD700', description || '', sort_order || 0]
    );
    res.json({ code: 0, msg: '创建成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 更新会员配置
export async function updateMembershipConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { product_type, name, price, sale_price, duration_days, badge_icon, badge_color, description, is_active, sort_order } = req.body;
    await execute(
      'UPDATE membership_config SET product_type = ?, name = ?, price = ?, sale_price = ?, duration_days = ?, badge_icon = ?, badge_color = ?, description = ?, is_active = ?, sort_order = ? WHERE id = ?',
      [product_type, name, price, sale_price, duration_days, badge_icon || '', badge_color || '#FFD700', description || '', is_active ? 1 : 0, sort_order || 0, id]
    );
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 删除会员配置
export async function deleteMembershipConfig(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await execute('DELETE FROM membership_config WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取当前会员状态
export async function getMemberStatus(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const userInfo = await queryOne(
      'SELECT id, username, membership_type, membership_expire_at, membership_start_at, member_badge FROM users WHERE id = ?',
      [user.userId]
    );
    if (!userInfo) {
      res.json({ code: 404, msg: '用户不存在' });
      return;
    }
    const isAdminRole = user.role === 'admin' || user.role === 'superadmin';
    const isMember = isAdminRole || (userInfo.membership_type !== 'free' && userInfo.membership_expire_at && new Date(userInfo.membership_expire_at) > new Date());
    res.json({
      code: 0,
      data: {
        ...userInfo,
        membership_type: isAdminRole ? 'yearly' : userInfo.membership_type,
        membership_expire_at: isAdminRole ? '2099-12-31 23:59:59' : userInfo.membership_expire_at,
        member_badge: isAdminRole ? 'VIP' : userInfo.member_badge,
        isMember,
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 创建订单
export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { product_type } = req.body;
    const config = await queryOne('SELECT * FROM membership_config WHERE product_type = ? AND is_active = 1', [product_type]);
    if (!config) {
      res.json({ code: 400, msg: '会员类型不存在或已下架' });
      return;
    }
    const orderNo = generateOrderNo();
    await execute(
      'INSERT INTO member_orders (user_id, order_no, product_type, amount, status) VALUES (?, ?, ?, ?, ?)',
      [user.userId, orderNo, product_type, config.sale_price, 'pending']
    );
    res.json({ code: 0, data: { orderNo, amount: config.sale_price, productName: config.name } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取订单列表
export async function getOrders(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', size = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(size as string);
    const totalRow = await queryOne('SELECT COUNT(*) as count FROM member_orders');
    const rows = await query(
      'SELECT mo.*, u.username FROM member_orders mo LEFT JOIN users u ON mo.user_id = u.id ORDER BY mo.created_at DESC LIMIT ? OFFSET ?',
      [parseInt(size as string), offset]
    );
    res.json({ code: 0, data: { list: rows, total: totalRow?.count || 0 } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 订单统计（仅统计已支付订单）
export async function getOrderStats(req: Request, res: Response): Promise<void> {
  try {
    const totalRow = await queryOne(
      "SELECT COUNT(*) as count, COALESCE(SUM(pay_amount), 0) as total FROM member_orders WHERE status = 'paid'"
    );
    const todayRow = await queryOne(
      "SELECT COALESCE(SUM(pay_amount), 0) as total FROM member_orders WHERE status = 'paid' AND DATE(paid_at) = CURDATE()"
    );
    const allRow = await queryOne(
      'SELECT COUNT(*) as count FROM member_orders'
    );
    res.json({
      code: 0,
      data: {
        totalAmount: Number(totalRow?.total) || 0,
        todayAmount: Number(todayRow?.total) || 0,
        totalOrders: allRow?.count || 0,
        paidOrders: totalRow?.count || 0,
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取当前用户订单
export async function getMyOrders(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user;
    const { page = '1', size = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(size as string);
    const totalRow = await queryOne('SELECT COUNT(*) as count FROM member_orders WHERE user_id = ?', [user.userId]);
    const rows = await query(
      'SELECT * FROM member_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [user.userId, parseInt(size as string), offset]
    );
    res.json({ code: 0, data: { list: rows, total: totalRow?.count || 0 } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 手动开通会员（管理员操作）
export async function grantMembership(req: Request, res: Response): Promise<void> {
  try {
    const { userId, product_type } = req.body;
    const config = await queryOne('SELECT * FROM membership_config WHERE product_type = ?', [product_type]);
    if (!config) {
      res.json({ code: 400, msg: '会员类型不存在' });
      return;
    }
    const now = new Date();
    const expireAt = new Date(now.getTime() + config.duration_days * 24 * 60 * 60 * 1000);
    await execute(
      'UPDATE users SET membership_type = ?, membership_start_at = ?, membership_expire_at = ?, member_badge = ? WHERE id = ?',
      [product_type, now, expireAt, config.badge_icon || '', userId]
    );
    res.json({ code: 0, msg: '开通成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 取消会员
export async function revokeMembership(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    await execute(
      "UPDATE users SET membership_type = 'free', membership_start_at = NULL, membership_expire_at = NULL, member_badge = '' WHERE id = ?",
      [userId]
    );
    res.json({ code: 0, msg: '已取消会员资格' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取会员名单（含管理员自动会员）
export async function getMemberList(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', size = '20', keyword } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(size as string);

    let whereSql = "WHERE (membership_type != 'free' OR role IN ('admin', 'superadmin'))";
    const params: any[] = [];

    if (keyword) {
      whereSql += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const totalRow = await queryOne(`SELECT COUNT(*) as count FROM users ${whereSql}`, params);
    const rows = await query(
      `SELECT id, username, email, role, membership_type, membership_start_at, membership_expire_at, member_badge, last_login_at, created_at FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(size as string), offset]
    ) as any[];

    // 管理员自动为最高级别会员
    for (const user of rows) {
      if (user.role === 'admin' || user.role === 'superadmin') {
        user.membership_type = 'yearly';
        user.membership_expire_at = '2099-12-31 23:59:59';
        user.member_badge = 'VIP';
      }
    }

    res.json({ code: 0, data: { list: rows, total: totalRow?.count || 0 } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '../config/database';
import { generateToken, JwtPayload } from '../middleware/auth';
import { getUserPermissions } from '../services/permissionService';

// 注册
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.json({ code: 400, msg: '用户名、邮箱和密码不能为空' });
      return;
    }
    if (password.length < 6) {
      res.json({ code: 400, msg: '密码长度不能少于6位' });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      res.json({ code: 400, msg: '用户名或邮箱已存在' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const token = generateToken({
      userId: result.insertId,
      username,
      role: 'user',
    });

    res.json({
      code: 0,
      msg: '注册成功',
      data: {
        token,
        user: { id: result.insertId, username, email, role: 'user' },
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 登录
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.json({ code: 400, msg: '用户名和密码不能为空' });
      return;
    }

    const user = await queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);
    if (!user) {
      res.json({ code: 400, msg: '用户不存在' });
      return;
    }
    if (!user.is_active) {
      res.json({ code: 400, msg: '账号已被禁用' });
      return;
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      res.json({ code: 400, msg: '密码错误' });
      return;
    }

    // 更新最后登录时间
    await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const permissions = await getUserPermissions(user.id, user.role);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions,
    });

    const isAdminRole = user.role === 'admin' || user.role === 'superadmin';
    const isMember = isAdminRole || (user.membership_type !== 'free' && user.membership_expire_at && new Date(user.membership_expire_at) > new Date());
    res.json({
      code: 0,
      msg: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
          permissions,
          membership_type: isAdminRole ? 'yearly' : (user.membership_type || 'free'),
          membership_expire_at: isAdminRole ? '2099-12-31 23:59:59' : user.membership_expire_at,
          member_badge: isAdminRole ? 'VIP' : (user.member_badge || ''),
          isMember,
        },
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 获取个人信息
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user as JwtPayload;
    const userInfo = await queryOne(
      'SELECT id, username, email, role, avatar_url, created_at, membership_type, membership_expire_at, membership_start_at, member_badge FROM users WHERE id = ?',
      [user.userId]
    );

    if (!userInfo) {
      res.json({ code: 404, msg: '用户不存在' });
      return;
    }

    const shelfCount = await queryOne('SELECT COUNT(*) as count FROM user_books WHERE user_id = ?', [user.userId]);
    const permissions = await getUserPermissions(user.userId, user.role);
    const isAdminRole = user.role === 'admin' || user.role === 'superadmin';
    const isMember = isAdminRole || (userInfo.membership_type !== 'free' && userInfo.membership_expire_at && new Date(userInfo.membership_expire_at) > new Date());

    res.json({
      code: 0,
      data: {
        ...userInfo,
        membership_type: isAdminRole ? 'yearly' : userInfo.membership_type,
        membership_expire_at: isAdminRole ? '2099-12-31 23:59:59' : userInfo.membership_expire_at,
        member_badge: isAdminRole ? 'VIP' : userInfo.member_badge,
        permissions,
        shelf_count: shelfCount?.count || 0,
        isMember,
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 更新个人信息
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user as JwtPayload;
    const { email, avatar_url } = req.body;
    const normalizedEmail = email && email.trim() ? email.trim() : null;
    const normalizedAvatar = avatar_url && avatar_url.trim() ? avatar_url.trim() : null;

    if (normalizedEmail) {
      const existing = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [normalizedEmail, user.userId]);
      if (existing) {
        res.json({ code: 400, msg: '邮箱已被使用' });
        return;
      }
    }

    await execute(
      'UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?',
      [normalizedEmail, normalizedAvatar, user.userId]
    );

    // 返回更新后的用户信息
    const userInfo = await queryOne(
      'SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id = ?',
      [user.userId]
    );
    const shelfCount = await queryOne('SELECT COUNT(*) as count FROM user_books WHERE user_id = ?', [user.userId]);

    res.json({
      code: 0,
      msg: '更新成功',
      data: { ...userInfo, shelf_count: shelfCount?.count || 0 },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 修改密码
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as any).user as JwtPayload;
    const { old_password, new_password } = req.body;

    const userInfo = await queryOne('SELECT password_hash FROM users WHERE id = ?', [user.userId]);
    if (!userInfo || !bcrypt.compareSync(old_password, userInfo.password_hash)) {
      res.json({ code: 400, msg: '原密码错误' });
      return;
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, user.userId]);

    res.json({ code: 0, msg: '密码修改成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

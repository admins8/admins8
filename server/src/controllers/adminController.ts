import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, execute } from '../config/database';
import { JwtPayload } from '../middleware/auth';
import { normalizeCategoryInput } from '../services/bookCategory';
import { listUserRecords } from '../services/userRecordService';
import { getUserPermissionMap, PERMISSIONS, PERMISSION_LABELS, PermissionKey } from '../services/permissionService';

// 管理后台 - 获取权限选项列表
export async function getPermissionOptions(_req: Request, res: Response): Promise<void> {
  try {
    const options = Object.values(PERMISSIONS).map(key => ({
      key,
      label: PERMISSION_LABELS[key],
    }));
    res.json({ code: 0, data: options });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 用户列表
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = (req as any).user as JwtPayload;
    const { page = '1', size = '20', keyword, role } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(size as string);

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    // test 角色只能看到普通用户
    if (currentUser.role === 'test') {
      whereSql += " AND role = 'user'";
    } else if (role) {
      whereSql += ' AND role = ?';
      params.push(role);
    }

    if (keyword) {
      whereSql += ' AND (username LIKE ? OR email LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const totalRow = await queryOne(`SELECT COUNT(*) as count FROM users ${whereSql}`, params);
    const total = totalRow?.count || 0;
    const users = await query(
      `SELECT id, username, email, role, is_active, created_at, updated_at, last_login_at, membership_type, membership_expire_at, member_badge FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(size as string), offset]
    ) as any[];

    // 批量获取用户权限，管理员自动为最高级别会员
    if (users.length > 0) {
      for (const user of users) {
        if (user.role === 'superadmin') {
          user.permissions = Object.values(PERMISSIONS);
          user.membership_type = 'yearly';
          user.membership_expire_at = '2099-12-31 23:59:59';
          user.member_badge = 'VIP';
        } else if (user.role === 'admin') {
          user.membership_type = 'yearly';
          user.membership_expire_at = '2099-12-31 23:59:59';
          user.member_badge = 'VIP';
        }
      }
      // 对admin和普通用户批量查数据库
      const nonSuperUserIds = users.filter((u: any) => u.role !== 'superadmin').map((u: any) => u.id);
      if (nonSuperUserIds.length > 0) {
        const permMap = await getUserPermissionMap(nonSuperUserIds);
        for (const user of users) {
          if (user.role !== 'superadmin') {
            user.permissions = permMap.get(user.id) || [];
          }
        }
      }
    }

    res.json({
      code: 0,
      data: { list: users, total, page: parseInt(page as string), size: parseInt(size as string) },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 书籍去重 ==========

export async function dedupeBooks(req: Request, res: Response): Promise<void> {
  try {
    // 查找同名同作者的重复书籍
    const rows = await query(
      `SELECT name, author, COUNT(*) as cnt FROM books WHERE name IS NOT NULL AND name != '' GROUP BY name, author HAVING cnt > 1`
    ) as any[];

    let removed = 0;
    for (const row of rows) {
      const dupes = await query(
        `SELECT book_url, toc_url, total_chapter_num, updated_at, origin_name FROM books WHERE name = ? AND author = ?`,
        [row.name, row.author]
      ) as any[];

      if (dupes.length <= 1) continue;

      // 排序优先级：采集过的（有目录+有章节数）> 有目录的 > 最新更新的
      dupes.sort((a, b) => {
        const aCollected = (a.toc_url && a.total_chapter_num > 0) ? 1 : 0;
        const bCollected = (b.toc_url && b.total_chapter_num > 0) ? 1 : 0;
        if (aCollected !== bCollected) return bCollected - aCollected;
        const aHasToc = a.toc_url ? 1 : 0;
        const bHasToc = b.toc_url ? 1 : 0;
        if (aHasToc !== bHasToc) return bHasToc - aHasToc;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      // 保留第一条（采集过的优先），删除其余
      for (let i = 1; i < dupes.length; i++) {
        await execute('DELETE FROM books WHERE book_url = ?', [dupes[i].book_url]);
        removed++;
      }
    }

    res.json({ code: 0, data: { removed }, msg: `去重完成，删除 ${removed} 本重复书籍，保留采集过的书籍` });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// ========== 分类管理 ==========

export async function getBookCategories(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query('SELECT * FROM book_categories ORDER BY sort_order ASC, id ASC') as any[];
    const data = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sort_order,
      isActive: !!r.is_active,
    }));
    res.json({ code: 0, data });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function createBookCategory(req: Request, res: Response): Promise<void> {
  try {
    const input = normalizeCategoryInput(req.body);
    await execute(
      'INSERT INTO book_categories (name, sort_order, is_active) VALUES (?, ?, ?)',
      [input.name, input.sortOrder, input.isActive ? 1 : 0]
    );
    res.json({ code: 0, msg: '创建成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function updateBookCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    const input = normalizeCategoryInput(req.body);
    await execute(
      'UPDATE book_categories SET name = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [input.name, input.sortOrder, input.isActive ? 1 : 0, id]
    );
    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

export async function deleteBookCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    if (!id) {
      res.json({ code: 400, msg: '缺少id参数' });
      return;
    }
    await execute('DELETE FROM book_categories WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 更新用户状态
export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id, is_active, role } = req.body;
    const currentUser = (req as any).user as JwtPayload;

    // 不能修改自己的状态
    if (id === currentUser.userId) {
      res.json({ code: 403, msg: '不能修改自己的状态' });
      return;
    }

    // 获取目标用户当前角色
    const targetUser = await queryOne('SELECT role FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      res.json({ code: 404, msg: '用户不存在' });
      return;
    }

    // 只有superadmin能设置admin/superadmin角色，或修改admin/superadmin用户
    if (role || targetUser.role === 'admin' || targetUser.role === 'superadmin') {
      if (currentUser.role !== 'superadmin') {
        res.json({ code: 403, msg: '只有超级管理员能管理管理员账号' });
        return;
      }
    }

    if (is_active !== undefined) {
      await execute('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [is_active ? 1 : 0, id]);
    }
    if (role) {
      await execute('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [role, id]);
    }

    res.json({ code: 0, msg: '更新成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 创建用户（superadmin专用）
export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password, role = 'user' } = req.body;
    const currentUser = (req as any).user as JwtPayload;

    if (!username || !email || !password) {
      res.json({ code: 400, msg: '用户名、邮箱和密码不能为空' });
      return;
    }
    if (password.length < 6) {
      res.json({ code: 400, msg: '密码长度不能少于6位' });
      return;
    }

    // 只有superadmin能创建admin/superadmin账号
    if ((role === 'admin' || role === 'superadmin') && currentUser.role !== 'superadmin') {
      res.json({ code: 403, msg: '只有超级管理员能创建管理员账号' });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      res.json({ code: 400, msg: '用户名或邮箱已存在' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, role]
    );

    res.json({
      code: 0,
      msg: '创建成功',
      data: { id: result.insertId, username, email, role },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 删除用户（superadmin专用）
export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.body;
    const currentUser = (req as any).user as JwtPayload;

    if (id === currentUser.userId) {
      res.json({ code: 403, msg: '不能删除自己' });
      return;
    }

    // 获取目标用户角色
    const targetUser = await queryOne('SELECT role FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      res.json({ code: 404, msg: '用户不存在' });
      return;
    }

    // 只有superadmin能删除admin/superadmin用户
    if ((targetUser.role === 'admin' || targetUser.role === 'superadmin') && currentUser.role !== 'superadmin') {
      res.json({ code: 403, msg: '只有超级管理员能删除管理员账号' });
      return;
    }

    await execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 更新用户权限（superadmin专用）
export async function updateUserPermissions(req: Request, res: Response): Promise<void> {
  try {
    const { id, permissions } = req.body;
    const currentUser = (req as any).user as JwtPayload;

    if (!id || !Array.isArray(permissions)) {
      res.json({ code: 400, msg: '参数错误' });
      return;
    }

    if (currentUser.role !== 'superadmin') {
      res.json({ code: 403, msg: '只有超级管理员能修改用户权限' });
      return;
    }

    // 获取目标用户当前角色
    const targetUser = await queryOne('SELECT role FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      res.json({ code: 404, msg: '用户不存在' });
      return;
    }

    // 删除旧权限，插入新权限
    await execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    for (const perm of permissions) {
      if (perm) {
        await execute('INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)', [id, perm]);
      }
    }

    // 自动调整角色：有权限的user自动升级为admin，无权限的admin自动降级为user
    const hasPermissions = permissions.length > 0;
    if (targetUser.role === 'user' && hasPermissions) {
      await execute('UPDATE users SET role = ? WHERE id = ?', ['admin', id]);
    } else if (targetUser.role === 'admin' && !hasPermissions) {
      await execute('UPDATE users SET role = ? WHERE id = ?', ['user', id]);
    }

    const rows = await query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [id]);
    res.json({ code: 0, msg: '更新成功', data: { permissions: rows.map((r: any) => r.permission_key) } });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 修改用户密码（superadmin专用）
export async function updateUserPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id, password } = req.body;
    const currentUser = (req as any).user as JwtPayload;

    if (!id || !password) {
      res.json({ code: 400, msg: '用户ID和密码不能为空' });
      return;
    }

    if (password.length < 6) {
      res.json({ code: 400, msg: '密码长度不能少于6位' });
      return;
    }

    if (currentUser.role !== 'superadmin') {
      res.json({ code: 403, msg: '只有超级管理员能修改用户密码' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    await execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [passwordHash, id]);
    res.json({ code: 0, msg: '密码修改成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 获取用户记录（superadmin专用）
export async function getUserRecords(req: Request, res: Response): Promise<void> {
  try {
    const { type } = req.params;
    const result = await listUserRecords(String(type), req.query);
    res.json({ code: 0, data: result });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 统计数据
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await queryOne(`
      SELECT
        (SELECT COUNT(*) FROM users) as userCount,
        (SELECT COUNT(*) FROM books) as bookCount,
        (SELECT COUNT(*) FROM book_sources) as sourceCount,
        (SELECT COUNT(*) FROM book_chapters) as chapterCount,
        (SELECT COUNT(*) FROM book_contents) as contentCount
    `);

    // 访客数单独查询，避免 visitor_logs 表不存在时影响主数据
    let visitorCount = 0;
    try {
      const visitorRow = await queryOne('SELECT COUNT(DISTINCT visitor_key) as count FROM visitor_logs');
      visitorCount = visitorRow?.count || 0;
    } catch {
      // visitor_logs 表可能不存在，忽略错误
    }

    res.json({
      code: 0,
      data: {
        userCount: stats?.userCount || 0,
        bookCount: stats?.bookCount || 0,
        sourceCount: stats?.sourceCount || 0,
        chapterCount: stats?.chapterCount || 0,
        contentCount: stats?.contentCount || 0,
        visitorCount,
      },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 所有书籍
export async function getAllBooks(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', size = '20', keyword } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(size as string);

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];
    if (keyword) {
      whereSql += ' AND (b.name LIKE ? OR b.author LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const totalRow = await queryOne(`SELECT COUNT(*) as count FROM books b ${whereSql}`, params);
    const total = totalRow?.count || 0;
    const books = await query(
      `SELECT b.*,
        b.book_url AS bookUrl,
        b.toc_url AS tocUrl,
        b.origin_name AS sourceName,
        b.origin AS sourceUrl,
        b.cover_url AS coverUrl,
        b.custom_cover_url AS customCoverUrl,
        b.total_chapter_num AS totalChapterNum,
        b.latest_chapter_title AS latestChapterTitle,
        b.latest_chapter_time AS latestChapterTime,
        b.last_check_time AS lastCheckTime,
        b.word_count AS wordCount,
        b.can_update AS canUpdate,
        b.order_num AS orderNum,
        b.created_at AS createdAt,
        b.updated_at AS updatedAt,
        r.lastReadTime
       FROM books b
       LEFT JOIN (
         SELECT book_name, book_author, MAX(last_read_at) AS lastReadTime
         FROM read_records
         GROUP BY book_name, book_author
       ) r ON r.book_name = b.name AND (r.book_author = b.author OR (r.book_author IS NULL AND b.author IS NULL))
       ${whereSql}
       ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(size as string), offset]
    );

    res.json({
      code: 0,
      data: { list: books, total, page: parseInt(page as string), size: parseInt(size as string) },
    });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

// 管理后台 - 删除书籍
export async function deleteBook(req: Request, res: Response): Promise<void> {
  try {
    const { bookUrl } = req.body;
    if (!bookUrl) {
      res.json({ code: 400, msg: '缺少书籍URL参数' });
      return;
    }
    await execute('DELETE FROM books WHERE book_url = ?', [bookUrl]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err: any) {
    res.json({ code: 500, msg: err.message });
  }
}

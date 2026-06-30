import { Router } from 'express';
import {
  getUsers, updateUserStatus, getStats, getAllBooks, deleteBook, createUser, deleteUser,
  updateUserPermissions, updateUserPassword, getUserRecords,
  dedupeBooks, getBookCategories, createBookCategory, updateBookCategory, deleteBookCategory,
  getPermissionOptions,
} from '../controllers/adminController';
import { authMiddleware, adminMiddleware, superAdminMiddleware, testReadonlyMiddleware } from '../middleware/auth';

const router = Router();

// 所有接口都需要管理员权限
router.use(authMiddleware, adminMiddleware);

// 权限选项（admin和superadmin都可获取，用于用户编辑页面的权限列表）
router.get('/permission-options', getPermissionOptions);

// 仪表盘统计（admin和superadmin都可访问）
router.get('/stats', getStats);
router.get('/books', getAllBooks);
router.post('/books/delete', testReadonlyMiddleware, deleteBook);
router.post('/books/dedupe', testReadonlyMiddleware, dedupeBooks);

// 分类管理
router.get('/book-categories', getBookCategories);
router.post('/book-categories/create', testReadonlyMiddleware, createBookCategory);
router.post('/book-categories/update', testReadonlyMiddleware, updateBookCategory);
router.post('/book-categories/delete', testReadonlyMiddleware, deleteBookCategory);

// 用户管理（superadmin和有权限的admin/test可访问）
router.get('/users', superAdminMiddleware, getUsers);
router.post('/users/status', testReadonlyMiddleware, superAdminMiddleware, updateUserStatus);
router.post('/users/create', testReadonlyMiddleware, superAdminMiddleware, createUser);
router.post('/users/delete', testReadonlyMiddleware, superAdminMiddleware, deleteUser);
router.post('/users/permissions', testReadonlyMiddleware, superAdminMiddleware, updateUserPermissions);
router.post('/users/password', testReadonlyMiddleware, superAdminMiddleware, updateUserPassword);
router.get('/user-records/:type', superAdminMiddleware, getUserRecords);

export default router;

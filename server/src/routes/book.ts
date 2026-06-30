import { Router } from 'express';
import {
  getBookshelf, addBook, removeBook,
  getChapterList, getBookContent, saveProgress,
  refreshToc,
  getAppSettings, getBookInfo,
} from '../controllers/bookController';
import { searchBooks, getAlternateSources, streamAlternateSources, switchBookSource,
  checkCollectorUpdate, updateCollectorBook,
  getSocialStats, getComments, addComment, deleteComment, toggleLike,
  toggleAuthorFollowHandler, getAuthorFollowStatus, getMyFollowedAuthors,
  switchChapter, streamChapterAlternatives } from '../controllers/book';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

// 搜索接口允许匿名访问
router.get('/search', optionalAuth, searchBooks);

// 换源接口允许匿名访问（内部有访客限制逻辑）
router.get('/alternate-sources', optionalAuth, getAlternateSources);
router.get('/alternate-sources/stream', optionalAuth, streamAlternateSources);
router.post('/switch-source', optionalAuth, switchBookSource);

// 章节级换源
router.post('/chapter-switch', optionalAuth, switchChapter);
router.post('/chapter-alternatives-stream', optionalAuth, streamChapterAlternatives);

// 作者关注状态查询允许匿名（用于未登录时显示粉丝数）
router.get('/author-follow-status', optionalAuth, getAuthorFollowStatus);

// 其他书籍接口需要登录
router.use(authMiddleware);

router.get('/bookshelf', getBookshelf);
router.post('/add', addBook);
router.post('/remove', removeBook);
router.get('/chapters', getChapterList);
router.get('/info', getBookInfo);
router.get('/content', getBookContent);
router.post('/progress', saveProgress);
router.get('/refresh-toc', refreshToc);

// 采集更新
router.get('/collector-update-check', checkCollectorUpdate);
router.post('/collector-update', updateCollectorBook);

// Legado APP 设置（GET 获取，POST 设置）
router.get('/app-settings', getAppSettings);
router.post('/app-settings', getAppSettings);

// 社交功能（评论、点赞、统计）
router.get('/social-stats', getSocialStats);
router.get('/comments', getComments);
router.post('/comments', addComment);
router.post('/comments/delete', deleteComment);
router.post('/like-toggle', toggleLike);

// 作者关注（需要登录）
router.post('/author-follow-toggle', authMiddleware, toggleAuthorFollowHandler);
router.get('/my-followed-authors', authMiddleware, getMyFollowedAuthors);

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookController_1 = require("../controllers/bookController");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
router.get('/chapters', auth_1.optionalAuth, bookController_1.getChapterList);
router.get('/content', auth_1.optionalAuth, (0, rateLimit_1.rateLimit)(60000, 120), bookController_1.getBookContent);
router.get('/search', auth_1.optionalAuth, (0, rateLimit_1.rateLimit)(60000, 10), bookController_1.searchBooks);
router.get('/alternate-sources', auth_1.optionalAuth, (0, rateLimit_1.rateLimit)(60000, 10), bookController_1.getAlternateSources);
router.get('/alternate-sources/stream', auth_1.optionalAuth, (0, rateLimit_1.rateLimit)(60000, 10), bookController_1.streamAlternateSources);
router.post('/switch-source', auth_1.optionalAuth, bookController_1.switchBookSource);
router.get('/collector-update-check', auth_1.optionalAuth, (0, rateLimit_1.rateLimit)(60000, 20), bookController_1.checkCollectorUpdate);
router.get('/comments', auth_1.optionalAuth, bookController_1.getComments);
router.get('/social-stats', auth_1.optionalAuth, bookController_1.getSocialStats);
// 以下书籍接口需要登录
router.use(auth_1.authMiddleware);
router.get('/bookshelf', bookController_1.getBookshelf);
router.post('/add', bookController_1.addBook);
router.post('/remove', bookController_1.removeBook);
router.post('/comments', bookController_1.addComment);
router.post('/comments/delete', bookController_1.deleteComment);
router.post('/like-toggle', bookController_1.toggleLike);
router.post('/progress', bookController_1.saveProgress);
router.get('/refresh-toc', bookController_1.refreshToc);
router.post('/collector-update', bookController_1.updateCollectorBook);
// Legado APP 设置（GET 获取，POST 设置）
router.get('/app-settings', bookController_1.getAppSettings);
router.post('/app-settings', bookController_1.getAppSettings);
exports.default = router;
//# sourceMappingURL=book.js.map
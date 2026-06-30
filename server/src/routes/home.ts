import { Router } from 'express';
import {
  getHotSearches, getAllHotSearches, addHotSearch, updateHotSearch, deleteHotSearch,
  getHotRankings, getAllHotRankings, addHotRanking, updateHotRanking, deleteHotRanking,
  getHotTags, getAllHotTags, addHotTag, updateHotTag, deleteHotTag,
  getRankingMeta, getRankingsGrouped, getLocalLibrary, refreshRankings,
} from '../controllers/homeController';
import { authMiddleware, adminMiddleware, testReadonlyMiddleware } from '../middleware/auth';

const router = Router();

// 公开接口（首页展示用）
router.get('/searches', getHotSearches);
router.get('/rankings', getHotRankings);
router.get('/rankings/meta', getRankingMeta);
router.get('/rankings/grouped', getRankingsGrouped);
router.get('/tags', getHotTags);
router.get('/library', getLocalLibrary);

// 管理接口（需要管理员权限）
router.use(authMiddleware, adminMiddleware);
router.get('/searches/all', getAllHotSearches);
router.post('/searches', testReadonlyMiddleware, addHotSearch);
router.put('/searches', testReadonlyMiddleware, updateHotSearch);
router.post('/searches/delete', testReadonlyMiddleware, deleteHotSearch);

router.get('/rankings/all', getAllHotRankings);
router.post('/rankings', testReadonlyMiddleware, addHotRanking);
router.put('/rankings', testReadonlyMiddleware, updateHotRanking);
router.post('/rankings/delete', testReadonlyMiddleware, deleteHotRanking);
router.post('/rankings/refresh', testReadonlyMiddleware, refreshRankings);

router.get('/tags/all', getAllHotTags);
router.post('/tags', testReadonlyMiddleware, addHotTag);
router.put('/tags', testReadonlyMiddleware, updateHotTag);
router.post('/tags/delete', testReadonlyMiddleware, deleteHotTag);

export default router;

import { Router } from 'express';
import {
  getHotSearches, getAllHotSearches, addHotSearch, updateHotSearch, deleteHotSearch,
  getHotRankings, getAllHotRankings, addHotRanking, updateHotRanking, deleteHotRanking,
  getHotTags, getAllHotTags, addHotTag, updateHotTag, deleteHotTag,
  getRankingMeta, getRankingsGrouped, getLocalLibrary, refreshRankings,
} from '../controllers/homeController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

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
router.post('/searches', addHotSearch);
router.put('/searches', updateHotSearch);
router.post('/searches/delete', deleteHotSearch);

router.get('/rankings/all', getAllHotRankings);
router.post('/rankings', addHotRanking);
router.put('/rankings', updateHotRanking);
router.post('/rankings/delete', deleteHotRanking);
router.post('/rankings/refresh', refreshRankings);

router.get('/tags/all', getAllHotTags);
router.post('/tags', addHotTag);
router.put('/tags', updateHotTag);
router.post('/tags/delete', delet
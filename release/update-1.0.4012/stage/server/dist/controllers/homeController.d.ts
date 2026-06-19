import { Request, Response } from 'express';
export declare function getHotSearches(req: Request, res: Response): Promise<void>;
export declare function getAllHotSearches(req: Request, res: Response): Promise<void>;
export declare function addHotSearch(req: Request, res: Response): Promise<void>;
export declare function updateHotSearch(req: Request, res: Response): Promise<void>;
export declare function deleteHotSearch(req: Request, res: Response): Promise<void>;
/**
 * 公开接口：获取首页排行榜数据。
 * - 不传参时返回 popularity 榜单（首页右侧入口卡片用）
 * - 传 type/category 时按类型 + 分类筛选
 */
export declare function getHotRankings(req: Request, res: Response): Promise<void>;
/**
 * 公开接口：按 6 类榜单分组返回（独立排行榜页用，单次拉取所有榜单）。
 */
export declare function getRankingsGrouped(req: Request, res: Response): Promise<void>;
/**
 * 公开接口：返回所有榜单类型与分类（分类从 book_categories 表动态加载）。
 */
export declare function getRankingMeta(_req: Request, res: Response): Promise<void>;
export declare function getLocalLibrary(req: Request, res: Response): Promise<void>;
export declare function getAllHotRankings(req: Request, res: Response): Promise<void>;
export declare function addHotRanking(req: Request, res: Response): Promise<void>;
export declare function updateHotRanking(req: Request, res: Response): Promise<void>;
export declare function deleteHotRanking(req: Request, res: Response): Promise<void>;
/**
 * 管理接口：根据用户阅读情况自动刷新排行榜（覆盖式生成 6 类榜单数据）。
 * 数据来源：books + user_books JOIN，统计每本书的读者数、章节数等。
 */
export declare function refreshRankingsFromUserData(_req: Request, res: Response): Promise<void>;
export declare function getHotTags(req: Request, res: Response): Promise<void>;
export declare function getAllHotTags(req: Request, res: Response): Promise<void>;
export declare function addHotTag(req: Request, res: Response): Promise<void>;
export declare function updateHotTag(req: Request, res: Response): Promise<void>;
export declare function deleteHotTag(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=homeController.d.ts.map
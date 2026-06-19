import { Request, Response } from 'express';
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
/** 按位置获取启用中的广告（已过滤生效时间） */
export declare function getAdsByPosition(req: Request, res: Response): Promise<void>;
/** 获取所有广告（可按 position 过滤） */
export declare function getAllAds(req: Request, res: Response): Promise<void>;
export declare function addAd(req: Request, res: Response): Promise<void>;
export declare function updateAd(req: Request, res: Response): Promise<void>;
export declare function deleteAd(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=adController.d.ts.map
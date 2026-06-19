import { Request, Response } from 'express';
/**
 * GET /api/admin/update/version
 * 返回当前版本号与更新清单 URL
 */
export declare function getVersion(_req: Request, res: Response): Promise<void>;
/**
 * GET /api/admin/update/check
 * 拉取 manifest 并比较版本
 */
export declare function check(_req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/admin/update/download
 * 触发后端下载 + 校验 + 解压（不替换 dist）
 */
export declare function download(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export declare const uploadUpdateMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * POST /api/admin/update/upload
 * 手动上传 update.zip + update.zip.sig
 */
export declare function uploadPackage(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /api/admin/update/install
 * 应用最近一次下载/上传的更新包
 */
export declare function install(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /api/admin/update/history
 */
export declare function history(_req: Request, res: Response): Promise<void>;
/**
 * POST /api/admin/update/rollback
 * body: { backupPath }
 */
export declare function rollback(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=updateController.d.ts.map
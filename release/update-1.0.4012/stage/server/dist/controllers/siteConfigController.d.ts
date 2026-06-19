import { Request, Response } from 'express';
/** 获取所有配置 */
export declare function getAllConfigs(req: Request, res: Response): Promise<void>;
/** 获取公开配置：只能返回前台展示必需字段，严禁泄露邮箱、密码、token、secret 等 */
export declare function getPublicConfigs(_req: Request, res: Response): Promise<void>;
/** 获取单个配置 */
export declare function getConfig(req: Request, res: Response): Promise<void>;
export declare function getPublicConfig(req: Request, res: Response): Promise<void>;
/** 更新配置 */
export declare function updateConfig(req: Request, res: Response): Promise<void>;
/** 批量更新配置 */
export declare function updateConfigs(req: Request, res: Response): Promise<void>;
/** 发送测试邮件 */
export declare function testEmailConfig(req: Request, res: Response): Promise<void>;
/** 检测搜索/换源代理是否可用 */
export declare function testProxyConfig(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=siteConfigController.d.ts.map
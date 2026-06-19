import { Request, Response } from 'express';
export declare const listPlugins: (req: Request, res: Response, next: any) => Promise<void>;
export declare const updatePluginStatus: (req: Request, res: Response, next: any) => Promise<void>;
export declare const getCollectorRules: (req: Request, res: Response, next: any) => Promise<void>;
export declare const upsertCollectorRule: (req: Request, res: Response, next: any) => Promise<void>;
export declare const removeCollectorRule: (req: Request, res: Response, next: any) => Promise<void>;
export declare const runCollectorRule: (req: Request, res: Response, next: any) => Promise<void>;
export declare const testRule: (req: Request, res: Response, next: any) => Promise<void>;
export declare const importRules: (req: Request, res: Response, next: any) => Promise<void>;
export declare const exportRules: (req: Request, res: Response, next: any) => Promise<void>;
export declare const getCollectorLogs: (req: Request, res: Response, next: any) => Promise<void>;
//# sourceMappingURL=collectorPluginController.d.ts.map
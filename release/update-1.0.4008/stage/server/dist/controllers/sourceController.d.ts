import { Request, Response } from 'express';
export declare function getSources(req: Request, res: Response): Promise<void>;
export declare function getSource(req: Request, res: Response): Promise<void>;
export declare function normalizeImportPayload(payload: unknown): any[];
export type SourceCollectionUrlType = 'bookSource' | 'bookSourceCollection' | 'rssSourceCollection' | 'unsupportedAdvancedLegadoCollection' | 'unknown';
export declare function detectSourceCollectionUrlType(url: string): SourceCollectionUrlType;
export declare function importSources(req: Request, res: Response): Promise<void>;
export declare function getValidationSchedule(req: Request, res: Response): Promise<void>;
export declare function updateValidationSchedule(req: Request, res: Response): Promise<void>;
export declare function runValidationScheduleNow(req: Request, res: Response): Promise<void>;
export declare function updateSource(req: Request, res: Response): Promise<void>;
export declare function deleteSources(req: Request, res: Response): Promise<void>;
export declare function dedupeSources(req: Request, res: Response): Promise<void>;
export declare function getSourceGroups(req: Request, res: Response): Promise<void>;
export declare function importFromUrl(req: Request, res: Response): Promise<void>;
/** 单条验证（同步返回） */
export declare function validateSource(req: Request, res: Response): Promise<void>;
/** 批量验证（流式 SSE） */
export declare function validateSourcesStream(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=sourceController.d.ts.map
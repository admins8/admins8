import { Request, Response } from 'express';
export declare function getTables(req: Request, res: Response): Promise<void>;
export declare function postBackupTable(req: Request, res: Response): Promise<void>;
export declare function postBackupAll(req: Request, res: Response): Promise<void>;
export declare function getBackups(req: Request, res: Response): Promise<void>;
export declare function postRestore(req: Request, res: Response): Promise<void>;
export declare function deleteBackupFile(req: Request, res: Response): Promise<void>;
export declare function postOptimize(req: Request, res: Response): Promise<void>;
export declare function postRepair(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=databaseController.d.ts.map
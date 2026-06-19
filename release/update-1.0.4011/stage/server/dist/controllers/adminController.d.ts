import { Request, Response } from 'express';
export declare function getUsers(req: Request, res: Response): Promise<void>;
export declare function getUserRecords(req: Request, res: Response): Promise<void>;
export declare function updateUserPermissions(req: Request, res: Response): Promise<void>;
export declare function updateUserStatus(req: Request, res: Response): Promise<void>;
export declare function updateUserPassword(req: Request, res: Response): Promise<void>;
export declare function createUser(req: Request, res: Response): Promise<void>;
export declare function deleteUser(req: Request, res: Response): Promise<void>;
export declare function getStats(req: Request, res: Response): Promise<void>;
export declare function getAllBooks(req: Request, res: Response): Promise<void>;
export declare function deleteBook(req: Request, res: Response): Promise<void>;
export declare function dedupeBooks(req: Request, res: Response): Promise<void>;
export declare function setAutoDedupeInterval(req: Request, res: Response): Promise<void>;
export declare function getBookCategories(_req: Request, res: Response): Promise<void>;
export declare function createBookCategory(req: Request, res: Response): Promise<void>;
export declare function updateBookCategory(req: Request, res: Response): Promise<void>;
export declare function deleteBookCategory(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=adminController.d.ts.map
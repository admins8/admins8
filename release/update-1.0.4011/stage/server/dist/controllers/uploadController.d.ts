import { Request, Response } from 'express';
export declare function isAllowedImageMimeType(mimeType: string): boolean;
export declare const uploadImageMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function uploadImage(req: Request, res: Response): void;
//# sourceMappingURL=uploadController.d.ts.map
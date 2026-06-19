import type { NextFunction, Request, Response } from 'express';
export declare function getVisitorFingerprint(req: Request): string;
export declare function getVisitorKey(req: Request): string;
export declare function shouldTrackVisit(req: Request): boolean;
export declare function visitorTracker(req: Request, _res: Response, next: NextFunction): void;
//# sourceMappingURL=visitorStats.d.ts.map
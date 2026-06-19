import type { Response } from 'express';
export interface ApiResponse<T = unknown> {
    code: number;
    msg?: string;
    data?: T;
}
export declare function getErrorMessageForClient(err: unknown, fallbackMessage?: string, nodeEnv?: string | undefined): string;
export declare function sendSuccess<T>(res: Response, data?: T, msg?: string): Response<ApiResponse<T>>;
export declare function sendError(res: Response, err: unknown, fallbackMessage?: string, statusCode?: number): Response<ApiResponse>;
//# sourceMappingURL=apiResponse.d.ts.map
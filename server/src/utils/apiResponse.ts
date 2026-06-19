import type { Response } from 'express';

export interface ApiResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

export function getErrorMessageForClient(
  err: unknown,
  fallbackMessage = '服务器内部错误',
  nodeEnv = process.env.NODE_ENV
): string {
  if (nodeEnv === 'production') {
    return fallbackMessage || '服务器内部错误';
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === 'string' && err) {
    return err;
  }

  return fallbackMessage || '服务器内部错误';
}

export function sendSuccess<T>(res: Response, data?: T, msg?: string): Response<ApiResponse<T>> {
  const payload: ApiResponse<T> = { code: 0 };
  if (msg) payload.msg = msg;
  if (data !== undefined) payload.data = data;
  return res.json(payload);
}

export function sendError(
  res: Response,
  err: unknown,
  fallbackMessage = '服务器内部错误',
  statusCode = 500
): Response<ApiResponse> {
  console.error(err);
  return res.status(statusCode).json({
    code: statusCode,
    msg: getErrorMessageForClient(err, fallbackMessage),
  });
}

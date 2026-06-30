import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({
    code: 500,
    msg: err.message || '服务器内部错误',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 404,
    msg: `接口不存在: ${req.method} ${req.path}`,
  });
}

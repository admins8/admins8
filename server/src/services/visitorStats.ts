import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { execute } from '../config/database';

export function getVisitorFingerprint(req: Request): string {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  const ip = forwardedFor || realIp || req.ip || req.socket.remoteAddress || 'unknown';
  const ua = String(req.headers['user-agent'] || 'unknown');
  return `${ip}|${ua}`;
}

export function getVisitorKey(req: Request): string {
  return createHash('sha256').update(getVisitorFingerprint(req)).digest('hex');
}

export function shouldTrackVisit(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const path = req.path || '';
  if (path === '/api/health') return false;
  if (path.startsWith('/api/admin')) return false;
  if (path.startsWith('/api/upload')) return false;
  if (path.startsWith('/uploads')) return false;
  if (/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|map|woff2?|ttf)$/i.test(path)) return false;
  return true;
}

export function visitorTracker(req: Request, _res: Response, next: NextFunction): void {
  if (!shouldTrackVisit(req)) {
    next();
    return;
  }

  const fingerprint = getVisitorFingerprint(req);
  const visitorKey = getVisitorKey(req);
  const ip = fingerprint.split('|')[0] || 'unknown';
  const ua = String(req.headers['user-agent'] || '');
  const pagePath = req.originalUrl || req.path || '/';

  execute(
    `INSERT INTO visitor_logs (visitor_key, ip_address, user_agent, path, visit_count, first_visit_at, last_visit_at)
     VALUES (?, ?, ?, ?, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       visit_count = visit_count + 1,
       path = VALUES(path),
       last_visit_at = NOW()`,
    [visitorKey, ip, ua.slice(0, 500), pagePath.slice(0, 500)]
  ).catch((err) => {
    console.warn('[访客统计] 写入失败:', err?.message || err);
  });

  next();
}

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { config } from '../config';
import {
  checkUpdate,
  downloadAndVerify,
  verifyFileSignature,
  readPackageVersion,
  UpdateRelease,
} from '../services/updateService';
import {
  installUpdate,
  readHistory,
  rollbackTo,
} from '../services/updateExecutor';
import { getCurrentVersion } from '../services/versionService';

/**
 * 解析当前部署的 server / web 根目录。
 *
 * dist 编译完成后，app.js 实际运行路径形如：
 *   <serverRoot>/dist/app.js
 * 因此 serverRoot = path.resolve(__dirname, '..', '..')
 *
 * web 同级：
 *   <projectRoot>/server  与 <projectRoot>/web
 * 因此 webRoot = path.resolve(serverRoot, '..', 'web')
 */
function resolveDeployRoots(): { serverRoot: string; webRoot: string } {
  const serverRoot = path.resolve(__dirname, '..', '..');
  const webRoot = path.resolve(serverRoot, '..', 'web');
  return { serverRoot, webRoot };
}

function disableUpdateCache(res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

/**
 * GET /api/admin/update/version
 * 返回当前版本号与更新清单 URL
 */
export async function getVersion(_req: Request, res: Response) {
  disableUpdateCache(res);
  res.json({
    code: 0,
    data: {
      current: getCurrentVersion(),
      manifestUrl: config.update.manifestUrl,
      online: config.update.online,
    },
  });
}

/**
 * GET /api/admin/update/check
 * 拉取 manifest 并比较版本
 */
export async function check(_req: Request, res: Response) {
  disableUpdateCache(res);
  if (!(config as any).update?.online) {
    return res.json({
      code: 0,
      data: {
        hasUpdate: false,
        current: getCurrentVersion(),
        reason: '在线检查已关闭（UPDATE_ONLINE=false）',
      },
    });
  }
  const result = await checkUpdate();
  res.json({ code: 0, data: result });
}

/**
 * 内存中保留最近一次下载的解压目录，供 install 复用
 */
let lastPrepared: { release?: UpdateRelease; extractDir?: string; version?: string } = {};

/**
 * POST /api/admin/update/download
 * 触发后端下载 + 校验 + 解压（不替换 dist）
 */
export async function download(req: Request, res: Response) {
  if (!config.update.online) {
    return res.status(400).json({ code: 1, message: '在线升级已关闭，请使用手动上传' });
  }
  const result = await checkUpdate();
  if (!result.hasUpdate || !result.release) {
    return res.status(400).json({ code: 1, message: result.reason || '没有可用更新' });
  }
  try {
    fs.mkdirSync(config.update.workDir, { recursive: true });
    const workDir = fs.mkdtempSync(path.join(config.update.workDir, 'rel-'));
    const dl = await downloadAndVerify(result.release, {
      workDir,
      publicKeyPath: config.update.publicKeyPath,
    });
    lastPrepared = { release: result.release, extractDir: dl.extractDir, version: dl.version };
    res.json({
      code: 0,
      data: {
        version: dl.version,
        extractDir: dl.extractDir,
        zipPath: dl.zipPath,
      },
    });
  } catch (e: any) {
    res.status(500).json({ code: 1, message: e?.message || String(e) });
  }
}

/**
 * 上传中间件（手动 zip 升级）
 */
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(config.update.workDir, { recursive: true });
    cb(null, config.update.workDir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

export const uploadUpdateMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
}).fields([
  { name: 'package', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
]);

/**
 * POST /api/admin/update/upload
 * 手动上传 update.zip + update.zip.sig
 */
export async function uploadPackage(req: Request, res: Response) {
  const files = req.files as { package?: Express.Multer.File[]; signature?: Express.Multer.File[] } | undefined;
  if (!files?.package?.[0]) {
    return res.status(400).json({ code: 1, message: '请上传 package（update.zip）字段' });
  }
  const zipFile = files.package[0];
  let sigB64: string;
  if (files.signature?.[0]) {
    sigB64 = fs.readFileSync(files.signature[0].path, 'utf-8').trim();
  } else if (typeof req.body.signature === 'string' && req.body.signature.trim()) {
    sigB64 = req.body.signature.trim();
  } else {
    return res.status(400).json({ code: 1, message: '请上传 signature 文件或在表单字段 signature 中提供 base64 签名' });
  }

  try {
    let publicKeyPath = config.update.publicKeyPath;
    const fallbackPublicKeyPath = path.resolve(process.cwd(), 'data', 'updates', 'public.pem');
    if (!fs.existsSync(publicKeyPath)) {
      if (fs.existsSync(fallbackPublicKeyPath)) {
        publicKeyPath = fallbackPublicKeyPath;
      } else {
        throw new Error(`未找到公钥：${publicKeyPath}`);
      }
    }
    const pem = fs.readFileSync(publicKeyPath, 'utf-8');
    if (!verifyFileSignature(zipFile.path, sigB64, pem)) {
      return res.status(400).json({ code: 1, message: '升级包签名校验失败' });
    }
    const extractDir = path.join(config.update.workDir, `manual-${Date.now()}`);
    fs.mkdirSync(extractDir, { recursive: true });
    const zip = new AdmZip(zipFile.path);
    zip.extractAllTo(extractDir, true);
    const ver = readPackageVersion(extractDir);
    if (!ver) {
      return res.status(400).json({ code: 1, message: '升级包内未找到 version.txt' });
    }
    lastPrepared = { extractDir, version: ver };
    res.json({ code: 0, data: { version: ver, extractDir } });
  } catch (e: any) {
    res.status(500).json({ code: 1, message: e?.message || String(e) });
  }
}

/**
 * POST /api/admin/update/install
 * 应用最近一次下载/上传的更新包
 */
export async function install(req: Request, res: Response) {
  if (!lastPrepared.extractDir || !lastPrepared.version) {
    return res.status(400).json({ code: 1, message: '没有已准备好的升级包，请先下载或上传' });
  }
  const { serverRoot, webRoot } = resolveDeployRoots();
  const operator = (req as any).user?.username || 'admin';
  const result = installUpdate({
    extractDir: lastPrepared.extractDir,
    fromVersion: getCurrentVersion(),
    toVersion: lastPrepared.version,
    serverRoot,
    webRoot,
    operator,
  });
  if (result.success) {
    // 安装成功后清理下载目录，避免占用磁盘；失败时保留 lastPrepared，方便再次点击安装重试。
    try { fs.rmSync(lastPrepared.extractDir, { recursive: true, force: true }); } catch {}
    lastPrepared = {};
    res.json({ code: 0, data: result });
  } else {
    res.status(500).json({ code: 1, message: result.error, data: result });
  }
}

/**
 * GET /api/admin/update/history
 */
export async function history(_req: Request, res: Response) {
  res.json({ code: 0, data: readHistory() });
}

/**
 * POST /api/admin/update/rollback
 * body: { backupPath }
 */
export async function rollback(req: Request, res: Response) {
  const backupPath = String(req.body?.backupPath || '');
  if (!backupPath) {
    return res.status(400).json({ code: 1, message: '请提供 backupPath' });
  }
  // 安全检查：路径必须在 backupDir 内
  const resolved = path.resolve(backupPath);
  if (!resolved.startsWith(path.resolve(config.update.backupDir) + path.sep)) {
    return res.status(400).json({ code: 1, message: 'backupPath 不在合法备份目录内' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ code: 1, message: '备份目录不存在' });
  }
  const { serverRoot, webRoot } = resolveDeployRoots();
  const result = rollbackTo(resolved, { serverRoot, webRoot });
  if (result.success) {
    res.json({ code: 0, data: result });
  } else {
    res.status(500).json({ code: 1, message: result.error, data: result });
  }
}

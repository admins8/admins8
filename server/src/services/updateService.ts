import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { compareVersion, getCurrentVersion, isNewer } from './versionService';
import { config } from '../config';

/**
 * GitHub Pages manifest 结构
 */
export interface UpdateRelease {
  version: string;
  publishedAt: string;
  url: string;       // update.zip 的 https 地址
  sigUrl: string;    // update.zip.sig 的 https 地址（签名文件，base64 字符串）
  changelog?: string;
  minVersion?: string;
}

export interface UpdateManifest {
  latest: string;
  releases: UpdateRelease[];
}

export interface CheckResult {
  hasUpdate: boolean;
  current: string;
  latest?: string;
  release?: UpdateRelease;
  reason?: string;
}

export function formatUpdateCheckError(error: any): string {
  const message = error?.message || String(error || '');
  if (
    error?.name === 'AggregateError' ||
    message === 'AggregateError' ||
    /AggregateError/i.test(message)
  ) {
    return '无法访问更新清单，请检查服务器网络或 UPDATE_MANIFEST_URL 配置';
  }
  if (error?.code === 'ECONNABORTED' || /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return `无法访问更新清单：${message}`;
  }
  return message || '检查更新失败';
}

function isManifestNetworkError(error: any): boolean {
  const message = error?.message || String(error || '');
  return (
    error?.name === 'AggregateError' ||
    message === 'AggregateError' ||
    /AggregateError|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Network Error/i.test(message) ||
    ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code)
  );
}

/**
 * 拉取 manifest.json
 */
export async function fetchManifest(manifestUrl?: string): Promise<UpdateManifest> {
  const url = manifestUrl || config.update.manifestUrl;
  if (!url) {
    throw new Error('未配置 UPDATE_MANIFEST_URL');
  }
  // 强制不缓存
  const res = await axios.get(url, {
    timeout: 15000,
    responseType: 'json',
    headers: { 'Cache-Control': 'no-cache' },
    params: { _t: Date.now() },
  });
  const data = res.data;
  if (!data || typeof data !== 'object' || !data.latest || !Array.isArray(data.releases)) {
    throw new Error('manifest 结构非法');
  }
  return data as UpdateManifest;
}

/**
 * 检查是否有更新
 */
export async function checkUpdate(manifestUrl?: string): Promise<CheckResult> {
  const current = getCurrentVersion();
  try {
    const manifest = await fetchManifest(manifestUrl);
    const release = manifest.releases.find(r => r.version === manifest.latest)
      || manifest.releases.sort((a, b) => compareVersion(b.version, a.version))[0];
    if (!release) {
      return { hasUpdate: false, current, reason: 'manifest 没有任何 release' };
    }
    if (release.minVersion && compareVersion(current, release.minVersion) < 0) {
      return {
        hasUpdate: false,
        current,
        latest: release.version,
        release,
        reason: `当前版本 ${current} 低于 minVersion ${release.minVersion}，不能直接升级到 ${release.version}`,
      };
    }
    return {
      hasUpdate: isNewer(release.version, current),
      current,
      latest: release.version,
      release,
    };
  } catch (e: any) {
    if (isManifestNetworkError(e)) {
      return {
        hasUpdate: false,
        current,
        latest: current,
      };
    }
    return {
      hasUpdate: false,
      current,
      reason: formatUpdateCheckError(e),
    };
  }
}

/**
 * 下载 url 到本地文件
 */
async function downloadTo(url: string, filePath: string): Promise<void> {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  fs.writeFileSync(filePath, Buffer.from(res.data));
}

/**
 * 用 RSA-SHA256 + 项目内置公钥校验文件签名
 */
export function verifyFileSignature(filePath: string, signatureBase64: string, publicKeyPem: string): boolean {
  const buf = fs.readFileSync(filePath);
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(buf);
  verifier.end();
  try {
    return verifier.verify(publicKeyPem, signatureBase64, 'base64');
  } catch {
    return false;
  }
}

export interface DownloadedPackage {
  zipPath: string;
  sigPath: string;
  extractDir: string;
  version: string;
}

/**
 * 下载并校验更新包，解压到独立目录。
 *
 * 解压目标：<workdir>/extracted/，里面应当包含 server/dist 与 web/dist。
 */
export async function downloadAndVerify(release: UpdateRelease, options?: {
  workDir?: string;
  publicKeyPath?: string;
}): Promise<DownloadedPackage> {
  const workDir = options?.workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'legado-update-'));
  const zipPath = path.join(workDir, 'update.zip');
  const sigPath = path.join(workDir, 'update.zip.sig');
  const extractDir = path.join(workDir, 'extracted');

  await downloadTo(release.url, zipPath);
  await downloadTo(release.sigUrl, sigPath);

  const sigB64 = fs.readFileSync(sigPath, 'utf-8').trim();
  const publicKeyPath = options?.publicKeyPath
    || process.env.LICENSE_PUBLIC_KEY_PATH
    || path.resolve(process.cwd(), 'license', 'public.pem');
  if (!fs.existsSync(publicKeyPath)) {
    throw new Error(`未找到公钥：${publicKeyPath}`);
  }
  const pem = fs.readFileSync(publicKeyPath, 'utf-8');
  if (!verifyFileSignature(zipPath, sigB64, pem)) {
    throw new Error('升级包签名校验失败，文件可能被篡改');
  }

  fs.mkdirSync(extractDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDir, true);

  // 校验 version.txt
  const ver = readPackageVersion(extractDir);
  if (ver !== release.version) {
    throw new Error(`升级包内 version.txt(${ver}) 与 manifest(${release.version}) 不一致`);
  }

  return { zipPath, sigPath, extractDir, version: ver };
}

export function readPackageVersion(extractDir: string): string {
  const candidates = [
    path.join(extractDir, 'version.txt'),
    path.join(extractDir, 'VERSION'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim();
  }
  return '';
}

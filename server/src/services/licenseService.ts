import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * License 文件结构
 *
 * 设计要点：
 * - 用 RSA-SHA256 对 payload 进行签名，应用启动时用内置公钥验签；
 * - payload 中包含 licenseId / customerId / domains 等字段，便于追溯每个客户版本；
 * - 不带过期时间，不向页面注入水印；
 * - 域名支持精确匹配与一级通配符，例如 ["soumal.com", "*.soumal.com"]。
 */
export interface LicensePayload {
  /** 授权唯一 ID，例如 LIC-2026-0001 */
  licenseId: string;
  /** 客户标识，例如 customer-soumal */
  customerId: string;
  /** 客户名称（人类可读） */
  customerName?: string;
  /** 允许使用的域名（支持 *.example.com 通配） */
  domains: string[];
  /** 可选：功能开关，便于后续按版本启用功能 */
  features?: Record<string, boolean>;
  /** 签发时间（ISO 字符串），仅作为审计用途 */
  issuedAt: string;
  /** 备注信息 */
  note?: string;
}

export interface LicenseFile {
  payload: LicensePayload;
  /** Base64 编码的 RSA-SHA256 签名 */
  signature: string;
}

export interface LicenseVerifyResult {
  valid: boolean;
  reason?: string;
  payload?: LicensePayload;
}

/**
 * 内置公钥位置：交付包根目录 license/public.pem。
 * 客户拿不到对应私钥，因此无法伪造或修改 license 文件。
 */
const DEFAULT_PUBLIC_KEY_PATH = process.env.LICENSE_PUBLIC_KEY_PATH
  || path.resolve(process.cwd(), 'license', 'public.pem');
const DEFAULT_LICENSE_PATH = process.env.LICENSE_FILE_PATH
  || path.resolve(process.cwd(), 'license', 'license.lic');

/** 读取并解析 license 文件 */
export function readLicenseFile(filePath: string = DEFAULT_LICENSE_PATH): LicenseFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`未找到授权文件：${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed: LicenseFile;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('授权文件格式错误：不是有效的 JSON');
  }
  if (!parsed || !parsed.payload || !parsed.signature) {
    throw new Error('授权文件缺少 payload 或 signature 字段');
  }
  return parsed;
}

/** 读取公钥 */
export function readPublicKey(keyPath: string = DEFAULT_PUBLIC_KEY_PATH): string {
  if (!fs.existsSync(keyPath)) {
    throw new Error(`未找到授权公钥：${keyPath}`);
  }
  return fs.readFileSync(keyPath, 'utf-8');
}

/**
 * 校验 license 签名是否合法。
 */
export function verifySignature(license: LicenseFile, publicKeyPem: string): boolean {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(canonicalize(license.payload));
  verifier.end();
  try {
    return verifier.verify(publicKeyPem, license.signature, 'base64');
  } catch {
    return false;
  }
}

/**
 * 把 payload 序列化为可重复签名的字符串。
 *
 * 必须用稳定的 key 排序，否则签名/验签会因为字段顺序不同失败。
 */
export function canonicalize(payload: LicensePayload): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

/**
 * 判断请求 host 是否被授权域名覆盖。
 *
 * - 完全匹配：domain === host
 * - 通配符：*.example.com 匹配 a.example.com / a.b.example.com，但不匹配 example.com
 * - 自动忽略端口与大小写
 */
export function isDomainAllowed(host: string, domains: string[]): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase().split(':')[0];
  for (const raw of domains || []) {
    const pattern = String(raw || '').toLowerCase().trim();
    if (!pattern) continue;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2);
      if (normalized === suffix) continue; // *.example.com 不匹配 example.com
      if (normalized.endsWith('.' + suffix)) return true;
    } else if (pattern === normalized) {
      return true;
    }
  }
  return false;
}

/**
 * 综合校验：读取文件 + 校验签名 + 返回 payload。
 *
 * 此函数不做域名匹配，由调用方在请求层根据 host 决定是否放行。
 */
export function verifyLicense(options?: {
  licensePath?: string;
  publicKeyPath?: string;
}): LicenseVerifyResult {
  try {
    const license = readLicenseFile(options?.licensePath);
    const publicKey = readPublicKey(options?.publicKeyPath);
    const ok = verifySignature(license, publicKey);
    if (!ok) {
      return { valid: false, reason: '授权签名验证失败，文件可能被篡改' };
    }
    if (!Array.isArray(license.payload.domains) || license.payload.domains.length === 0) {
      return { valid: false, reason: '授权文件未配置 domains' };
    }
    if (!license.payload.licenseId || !license.payload.customerId) {
      return { valid: false, reason: '授权文件缺少 licenseId / customerId' };
    }
    return { valid: true, payload: license.payload };
  } catch (e: any) {
    return { valid: false, reason: e?.message || String(e) };
  }
}

/**
 * 在内存中缓存当前授权信息，启动时设置一次，后续中间件读取。
 */
let activePayload: LicensePayload | null = null;

export function setActiveLicense(payload: LicensePayload | null): void {
  activePayload = payload;
}

export function getActiveLicense(): LicensePayload | null {
  return activePayload;
}

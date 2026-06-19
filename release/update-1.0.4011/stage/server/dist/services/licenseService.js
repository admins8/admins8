"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLicenseFile = readLicenseFile;
exports.readPublicKey = readPublicKey;
exports.verifySignature = verifySignature;
exports.canonicalize = canonicalize;
exports.isDomainAllowed = isDomainAllowed;
exports.verifyLicense = verifyLicense;
exports.setActiveLicense = setActiveLicense;
exports.getActiveLicense = getActiveLicense;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 内置公钥位置：交付包根目录 license/public.pem。
 * 客户拿不到对应私钥，因此无法伪造或修改 license 文件。
 */
const DEFAULT_PUBLIC_KEY_PATH = process.env.LICENSE_PUBLIC_KEY_PATH
    || path_1.default.resolve(process.cwd(), 'license', 'public.pem');
const DEFAULT_LICENSE_PATH = process.env.LICENSE_FILE_PATH
    || path_1.default.resolve(process.cwd(), 'license', 'license.lic');
/** 读取并解析 license 文件 */
function readLicenseFile(filePath = DEFAULT_LICENSE_PATH) {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`未找到授权文件：${filePath}`);
    }
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        throw new Error('授权文件格式错误：不是有效的 JSON');
    }
    if (!parsed || !parsed.payload || !parsed.signature) {
        throw new Error('授权文件缺少 payload 或 signature 字段');
    }
    return parsed;
}
/** 读取公钥 */
function readPublicKey(keyPath = DEFAULT_PUBLIC_KEY_PATH) {
    if (!fs_1.default.existsSync(keyPath)) {
        throw new Error(`未找到授权公钥：${keyPath}`);
    }
    return fs_1.default.readFileSync(keyPath, 'utf-8');
}
/**
 * 校验 license 签名是否合法。
 */
function verifySignature(license, publicKeyPem) {
    const verifier = crypto_1.default.createVerify('RSA-SHA256');
    verifier.update(canonicalize(license.payload));
    verifier.end();
    try {
        return verifier.verify(publicKeyPem, license.signature, 'base64');
    }
    catch {
        return false;
    }
}
/**
 * 把 payload 序列化为可重复签名的字符串。
 *
 * 必须用稳定的 key 排序，否则签名/验签会因为字段顺序不同失败。
 */
function canonicalize(payload) {
    return JSON.stringify(payload, Object.keys(payload).sort());
}
/**
 * 判断请求 host 是否被授权域名覆盖。
 *
 * - 完全匹配：domain === host
 * - 通配符：*.example.com 匹配 a.example.com / a.b.example.com，但不匹配 example.com
 * - 自动忽略端口与大小写
 */
function isDomainAllowed(host, domains) {
    if (!host)
        return false;
    const normalized = host.toLowerCase().split(':')[0];
    for (const raw of domains || []) {
        const pattern = String(raw || '').toLowerCase().trim();
        if (!pattern)
            continue;
        if (pattern.startsWith('*.')) {
            const suffix = pattern.slice(2);
            if (normalized === suffix)
                continue; // *.example.com 不匹配 example.com
            if (normalized.endsWith('.' + suffix))
                return true;
        }
        else if (pattern === normalized) {
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
function verifyLicense(options) {
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
    }
    catch (e) {
        return { valid: false, reason: e?.message || String(e) };
    }
}
/**
 * 在内存中缓存当前授权信息，启动时设置一次，后续中间件读取。
 */
let activePayload = null;
function setActiveLicense(payload) {
    activePayload = payload;
}
function getActiveLicense() {
    return activePayload;
}
//# sourceMappingURL=licenseService.js.map
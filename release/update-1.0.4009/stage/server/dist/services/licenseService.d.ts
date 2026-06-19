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
/** 读取并解析 license 文件 */
export declare function readLicenseFile(filePath?: string): LicenseFile;
/** 读取公钥 */
export declare function readPublicKey(keyPath?: string): string;
/**
 * 校验 license 签名是否合法。
 */
export declare function verifySignature(license: LicenseFile, publicKeyPem: string): boolean;
/**
 * 把 payload 序列化为可重复签名的字符串。
 *
 * 必须用稳定的 key 排序，否则签名/验签会因为字段顺序不同失败。
 */
export declare function canonicalize(payload: LicensePayload): string;
/**
 * 判断请求 host 是否被授权域名覆盖。
 *
 * - 完全匹配：domain === host
 * - 通配符：*.example.com 匹配 a.example.com / a.b.example.com，但不匹配 example.com
 * - 自动忽略端口与大小写
 */
export declare function isDomainAllowed(host: string, domains: string[]): boolean;
/**
 * 综合校验：读取文件 + 校验签名 + 返回 payload。
 *
 * 此函数不做域名匹配，由调用方在请求层根据 host 决定是否放行。
 */
export declare function verifyLicense(options?: {
    licensePath?: string;
    publicKeyPath?: string;
}): LicenseVerifyResult;
export declare function setActiveLicense(payload: LicensePayload | null): void;
export declare function getActiveLicense(): LicensePayload | null;
//# sourceMappingURL=licenseService.d.ts.map
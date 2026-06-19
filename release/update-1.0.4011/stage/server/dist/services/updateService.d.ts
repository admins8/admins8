/**
 * GitHub Pages manifest 结构
 */
export interface UpdateRelease {
    version: string;
    publishedAt: string;
    url: string;
    sigUrl: string;
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
export declare function formatUpdateCheckError(error: any): string;
/**
 * 拉取 manifest.json
 */
export declare function fetchManifest(manifestUrl?: string): Promise<UpdateManifest>;
/**
 * 检查是否有更新
 */
export declare function checkUpdate(manifestUrl?: string): Promise<CheckResult>;
/**
 * 用 RSA-SHA256 + 项目内置公钥校验文件签名
 */
export declare function verifyFileSignature(filePath: string, signatureBase64: string, publicKeyPem: string): boolean;
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
export declare function downloadAndVerify(release: UpdateRelease, options?: {
    workDir?: string;
    publicKeyPath?: string;
}): Promise<DownloadedPackage>;
export declare function readPackageVersion(extractDir: string): string;
//# sourceMappingURL=updateService.d.ts.map
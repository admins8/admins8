"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatUpdateCheckError = formatUpdateCheckError;
exports.fetchManifest = fetchManifest;
exports.checkUpdate = checkUpdate;
exports.verifyFileSignature = verifyFileSignature;
exports.downloadAndVerify = downloadAndVerify;
exports.readPackageVersion = readPackageVersion;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const versionService_1 = require("./versionService");
const config_1 = require("../config");
function formatUpdateCheckError(error) {
    const message = error?.message || String(error || '');
    if (error?.name === 'AggregateError' ||
        message === 'AggregateError' ||
        /AggregateError/i.test(message)) {
        return '无法访问更新清单，请检查服务器网络或 UPDATE_MANIFEST_URL 配置';
    }
    if (error?.code === 'ECONNABORTED' || /timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(message)) {
        return `无法访问更新清单：${message}`;
    }
    return message || '检查更新失败';
}
function isManifestNetworkError(error) {
    const message = error?.message || String(error || '');
    return (error?.name === 'AggregateError' ||
        message === 'AggregateError' ||
        /AggregateError|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Network Error/i.test(message) ||
        ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code));
}
/**
 * 拉取 manifest.json
 */
async function fetchManifest(manifestUrl) {
    const url = manifestUrl || config_1.config.update.manifestUrl;
    if (!url) {
        throw new Error('未配置 UPDATE_MANIFEST_URL');
    }
    // 强制不缓存
    const res = await axios_1.default.get(url, {
        timeout: 15000,
        responseType: 'json',
        headers: { 'Cache-Control': 'no-cache' },
        params: { _t: Date.now() },
    });
    const data = res.data;
    if (!data || typeof data !== 'object' || !data.latest || !Array.isArray(data.releases)) {
        throw new Error('manifest 结构非法');
    }
    return data;
}
/**
 * 检查是否有更新
 */
async function checkUpdate(manifestUrl) {
    const current = (0, versionService_1.getCurrentVersion)();
    try {
        const manifest = await fetchManifest(manifestUrl);
        const release = manifest.releases.find(r => r.version === manifest.latest)
            || manifest.releases.sort((a, b) => (0, versionService_1.compareVersion)(b.version, a.version))[0];
        if (!release) {
            return { hasUpdate: false, current, reason: 'manifest 没有任何 release' };
        }
        if (release.minVersion && (0, versionService_1.compareVersion)(current, release.minVersion) < 0) {
            return {
                hasUpdate: false,
                current,
                latest: release.version,
                release,
                reason: `当前版本 ${current} 低于 minVersion ${release.minVersion}，不能直接升级到 ${release.version}`,
            };
        }
        return {
            hasUpdate: (0, versionService_1.isNewer)(release.version, current),
            current,
            latest: release.version,
            release,
        };
    }
    catch (e) {
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
async function downloadTo(url, filePath) {
    const res = await axios_1.default.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    fs_1.default.writeFileSync(filePath, Buffer.from(res.data));
}
/**
 * 用 RSA-SHA256 + 项目内置公钥校验文件签名
 */
function verifyFileSignature(filePath, signatureBase64, publicKeyPem) {
    const buf = fs_1.default.readFileSync(filePath);
    const verifier = crypto_1.default.createVerify('RSA-SHA256');
    verifier.update(buf);
    verifier.end();
    try {
        return verifier.verify(publicKeyPem, signatureBase64, 'base64');
    }
    catch {
        return false;
    }
}
/**
 * 下载并校验更新包，解压到独立目录。
 *
 * 解压目标：<workdir>/extracted/，里面应当包含 server/dist 与 web/dist。
 */
async function downloadAndVerify(release, options) {
    const workDir = options?.workDir || fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'legado-update-'));
    const zipPath = path_1.default.join(workDir, 'update.zip');
    const sigPath = path_1.default.join(workDir, 'update.zip.sig');
    const extractDir = path_1.default.join(workDir, 'extracted');
    await downloadTo(release.url, zipPath);
    await downloadTo(release.sigUrl, sigPath);
    const sigB64 = fs_1.default.readFileSync(sigPath, 'utf-8').trim();
    const publicKeyPath = options?.publicKeyPath
        || process.env.LICENSE_PUBLIC_KEY_PATH
        || path_1.default.resolve(process.cwd(), 'license', 'public.pem');
    if (!fs_1.default.existsSync(publicKeyPath)) {
        throw new Error(`未找到公钥：${publicKeyPath}`);
    }
    const pem = fs_1.default.readFileSync(publicKeyPath, 'utf-8');
    if (!verifyFileSignature(zipPath, sigB64, pem)) {
        throw new Error('升级包签名校验失败，文件可能被篡改');
    }
    fs_1.default.mkdirSync(extractDir, { recursive: true });
    const zip = new adm_zip_1.default(zipPath);
    zip.extractAllTo(extractDir, true);
    // 校验 version.txt
    const ver = readPackageVersion(extractDir);
    if (ver !== release.version) {
        throw new Error(`升级包内 version.txt(${ver}) 与 manifest(${release.version}) 不一致`);
    }
    return { zipPath, sigPath, extractDir, version: ver };
}
function readPackageVersion(extractDir) {
    const candidates = [
        path_1.default.join(extractDir, 'version.txt'),
        path_1.default.join(extractDir, 'VERSION'),
    ];
    for (const p of candidates) {
        if (fs_1.default.existsSync(p))
            return fs_1.default.readFileSync(p, 'utf-8').trim();
    }
    return '';
}
//# sourceMappingURL=updateService.js.map
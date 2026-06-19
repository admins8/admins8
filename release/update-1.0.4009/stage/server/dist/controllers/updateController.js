"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadUpdateMiddleware = void 0;
exports.getVersion = getVersion;
exports.check = check;
exports.download = download;
exports.uploadPackage = uploadPackage;
exports.install = install;
exports.history = history;
exports.rollback = rollback;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const config_1 = require("../config");
const updateService_1 = require("../services/updateService");
const updateExecutor_1 = require("../services/updateExecutor");
const versionService_1 = require("../services/versionService");
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
function resolveDeployRoots() {
    const serverRoot = path_1.default.resolve(__dirname, '..', '..');
    const webRoot = path_1.default.resolve(serverRoot, '..', 'web');
    return { serverRoot, webRoot };
}
function disableUpdateCache(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
}
/**
 * GET /api/admin/update/version
 * 返回当前版本号与更新清单 URL
 */
async function getVersion(_req, res) {
    disableUpdateCache(res);
    res.json({
        code: 0,
        data: {
            current: (0, versionService_1.getCurrentVersion)(),
            manifestUrl: config_1.config.update.manifestUrl,
            online: config_1.config.update.online,
        },
    });
}
/**
 * GET /api/admin/update/check
 * 拉取 manifest 并比较版本
 */
async function check(_req, res) {
    disableUpdateCache(res);
    if (!config_1.config.update.online) {
        return res.json({
            code: 0,
            data: {
                hasUpdate: false,
                current: (0, versionService_1.getCurrentVersion)(),
                reason: '在线检查已关闭（UPDATE_ONLINE=false）',
            },
        });
    }
    const result = await (0, updateService_1.checkUpdate)();
    res.json({ code: 0, data: result });
}
/**
 * 内存中保留最近一次下载的解压目录，供 install 复用
 */
let lastPrepared = {};
/**
 * POST /api/admin/update/download
 * 触发后端下载 + 校验 + 解压（不替换 dist）
 */
async function download(req, res) {
    if (!config_1.config.update.online) {
        return res.status(400).json({ code: 1, message: '在线升级已关闭，请使用手动上传' });
    }
    const result = await (0, updateService_1.checkUpdate)();
    if (!result.hasUpdate || !result.release) {
        return res.status(400).json({ code: 1, message: result.reason || '没有可用更新' });
    }
    try {
        fs_1.default.mkdirSync(config_1.config.update.workDir, { recursive: true });
        const workDir = fs_1.default.mkdtempSync(path_1.default.join(config_1.config.update.workDir, 'rel-'));
        const dl = await (0, updateService_1.downloadAndVerify)(result.release, {
            workDir,
            publicKeyPath: config_1.config.update.publicKeyPath,
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
    }
    catch (e) {
        res.status(500).json({ code: 1, message: e?.message || String(e) });
    }
}
/**
 * 上传中间件（手动 zip 升级）
 */
const uploadStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        fs_1.default.mkdirSync(config_1.config.update.workDir, { recursive: true });
        cb(null, config_1.config.update.workDir);
    },
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    },
});
exports.uploadUpdateMiddleware = (0, multer_1.default)({
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
async function uploadPackage(req, res) {
    const files = req.files;
    if (!files?.package?.[0]) {
        return res.status(400).json({ code: 1, message: '请上传 package（update.zip）字段' });
    }
    const zipFile = files.package[0];
    let sigB64;
    if (files.signature?.[0]) {
        sigB64 = fs_1.default.readFileSync(files.signature[0].path, 'utf-8').trim();
    }
    else if (typeof req.body.signature === 'string' && req.body.signature.trim()) {
        sigB64 = req.body.signature.trim();
    }
    else {
        return res.status(400).json({ code: 1, message: '请上传 signature 文件或在表单字段 signature 中提供 base64 签名' });
    }
    try {
        const pem = fs_1.default.readFileSync(config_1.config.update.publicKeyPath, 'utf-8');
        if (!(0, updateService_1.verifyFileSignature)(zipFile.path, sigB64, pem)) {
            return res.status(400).json({ code: 1, message: '升级包签名校验失败' });
        }
        const extractDir = path_1.default.join(config_1.config.update.workDir, `manual-${Date.now()}`);
        fs_1.default.mkdirSync(extractDir, { recursive: true });
        const zip = new adm_zip_1.default(zipFile.path);
        zip.extractAllTo(extractDir, true);
        const ver = (0, updateService_1.readPackageVersion)(extractDir);
        if (!ver) {
            return res.status(400).json({ code: 1, message: '升级包内未找到 version.txt' });
        }
        lastPrepared = { extractDir, version: ver };
        res.json({ code: 0, data: { version: ver, extractDir } });
    }
    catch (e) {
        res.status(500).json({ code: 1, message: e?.message || String(e) });
    }
}
/**
 * POST /api/admin/update/install
 * 应用最近一次下载/上传的更新包
 */
async function install(req, res) {
    if (!lastPrepared.extractDir || !lastPrepared.version) {
        return res.status(400).json({ code: 1, message: '没有已准备好的升级包，请先下载或上传' });
    }
    const { serverRoot, webRoot } = resolveDeployRoots();
    const operator = req.user?.username || 'admin';
    const result = (0, updateExecutor_1.installUpdate)({
        extractDir: lastPrepared.extractDir,
        fromVersion: (0, versionService_1.getCurrentVersion)(),
        toVersion: lastPrepared.version,
        serverRoot,
        webRoot,
        operator,
    });
    if (result.success) {
        // 安装成功后清理下载目录，避免占用磁盘；失败时保留 lastPrepared，方便再次点击安装重试。
        try {
            fs_1.default.rmSync(lastPrepared.extractDir, { recursive: true, force: true });
        }
        catch { }
        lastPrepared = {};
        res.json({ code: 0, data: result });
    }
    else {
        res.status(500).json({ code: 1, message: result.error, data: result });
    }
}
/**
 * GET /api/admin/update/history
 */
async function history(_req, res) {
    res.json({ code: 0, data: (0, updateExecutor_1.readHistory)() });
}
/**
 * POST /api/admin/update/rollback
 * body: { backupPath }
 */
async function rollback(req, res) {
    const backupPath = String(req.body?.backupPath || '');
    if (!backupPath) {
        return res.status(400).json({ code: 1, message: '请提供 backupPath' });
    }
    // 安全检查：路径必须在 backupDir 内
    const resolved = path_1.default.resolve(backupPath);
    if (!resolved.startsWith(path_1.default.resolve(config_1.config.update.backupDir) + path_1.default.sep)) {
        return res.status(400).json({ code: 1, message: 'backupPath 不在合法备份目录内' });
    }
    if (!fs_1.default.existsSync(resolved)) {
        return res.status(404).json({ code: 1, message: '备份目录不存在' });
    }
    const { serverRoot, webRoot } = resolveDeployRoots();
    const result = (0, updateExecutor_1.rollbackTo)(resolved, { serverRoot, webRoot });
    if (result.success) {
        res.json({ code: 0, data: result });
    }
    else {
        res.status(500).json({ code: 1, message: result.error, data: result });
    }
}
//# sourceMappingURL=updateController.js.map
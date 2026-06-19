"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentVersion = getCurrentVersion;
exports.compareVersion = compareVersion;
exports.isNewer = isNewer;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * 读取当前运行版本。
 *
 * 优先级：
 * 1) dist/version.txt（混淆构建时由 obfuscate-dist 写入）
 * 2) 项目根 VERSION 文件（开发阶段）
 * 3) 兜底 '0.0.0'
 */
function getCurrentVersion() {
    const candidates = [
        path_1.default.resolve(__dirname, '..', 'version.txt'),
        path_1.default.resolve(process.cwd(), 'dist', 'version.txt'),
        path_1.default.resolve(process.cwd(), 'VERSION'),
        path_1.default.resolve(process.cwd(), '..', 'VERSION'),
    ];
    for (const p of candidates) {
        try {
            if (fs_1.default.existsSync(p)) {
                const v = fs_1.default.readFileSync(p, 'utf-8').trim();
                if (v)
                    return v;
            }
        }
        catch {
            // ignore
        }
    }
    return '0.0.0';
}
/**
 * 比较两个语义化版本号。
 * @returns -1 当 a < b, 0 当 a == b, 1 当 a > b
 */
function compareVersion(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i])
            return pa[i] < pb[i] ? -1 : 1;
    }
    return 0;
}
function parseVersion(v) {
    const parts = String(v || '').split('.').map(s => parseInt(s, 10) || 0);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
function isNewer(remote, local) {
    return compareVersion(remote, local) > 0;
}
//# sourceMappingURL=versionService.js.map
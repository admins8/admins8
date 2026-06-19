"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyDir = copyDir;
exports.restartPm2Process = restartPm2Process;
exports.installUpdate = installUpdate;
exports.readHistory = readHistory;
exports.rollbackTo = rollbackTo;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const config_1 = require("../config");
function ts() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
/** 复制目录（递归） */
function copyDir(src, dest) {
    if (!fs_1.default.existsSync(src))
        return;
    fs_1.default.mkdirSync(dest, { recursive: true });
    for (const name of fs_1.default.readdirSync(src)) {
        const s = path_1.default.join(src, name);
        const d = path_1.default.join(dest, name);
        const st = fs_1.default.statSync(s);
        if (st.isDirectory()) {
            copyDir(s, d);
        }
        else if (st.isFile()) {
            fs_1.default.copyFileSync(s, d);
        }
    }
}
/** 安全删除目录 */
function rmrf(p) {
    if (fs_1.default.existsSync(p)) {
        fs_1.default.rmSync(p, { recursive: true, force: true });
    }
}
/**
 * 原子替换：用 newDir 替换 targetDir。
 * 实际操作：
 *   1) 将 targetDir 重命名为 targetDir.old.<ts>
 *   2) 将 newDir 重命名为 targetDir
 *   3) 返回旧目录路径（供回滚）
 */
function atomicSwap(targetDir, newDir) {
    const oldDir = `${targetDir}.old.${ts()}`;
    if (fs_1.default.existsSync(targetDir)) {
        fs_1.default.renameSync(targetDir, oldDir);
    }
    try {
        fs_1.default.renameSync(newDir, targetDir);
    }
    catch (e) {
        // Windows 本地测试时，dist 目录可能被编辑器/预览进程短暂占用，
        // rename 可能抛 EPERM。此时退化为复制覆盖，生产 Linux 环境仍优先走原子 rename。
        if (process.platform !== 'win32' || e?.code !== 'EPERM') {
            throw e;
        }
        fs_1.default.mkdirSync(targetDir, { recursive: true });
        copyDir(newDir, targetDir);
        rmrf(newDir);
    }
    return fs_1.default.existsSync(oldDir) ? oldDir : null;
}
/** 回滚单个目录 */
function revertSwap(targetDir, oldDir) {
    if (!oldDir)
        return;
    rmrf(targetDir);
    if (fs_1.default.existsSync(oldDir)) {
        try {
            fs_1.default.renameSync(oldDir, targetDir);
        }
        catch (e) {
            if (process.platform !== 'win32' || e?.code !== 'EPERM') {
                throw e;
            }
            fs_1.default.mkdirSync(targetDir, { recursive: true });
            copyDir(oldDir, targetDir);
            rmrf(oldDir);
        }
    }
}
function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
function restartPm2Process(name, options = {}) {
    const pm2Bin = options.pm2Bin || process.env.PM2_BIN || 'pm2';
    const runner = options.runner || ((command, args) => {
        const result = (0, child_process_1.spawnSync)(command, args, {
            encoding: 'utf-8',
            timeout: 30000,
            windowsHide: true,
        });
        return {
            status: result.status,
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            error: result.error,
        };
    });
    const detachedRunner = options.detachedRunner || runner;
    const attempts = [
        { command: pm2Bin, args: ['reload', name, '--update-env'] },
        { command: pm2Bin, args: ['restart', name, '--update-env'] },
    ];
    if (pm2Bin !== '/bin/pm2') {
        attempts.push({ command: '/bin/pm2', args: ['restart', name, '--update-env'] });
    }
    const outputs = [];
    for (const attempt of attempts) {
        const result = runner(attempt.command, attempt.args);
        const output = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n');
        outputs.push(`${attempt.command} ${attempt.args.join(' ')}\n${output}`.trim());
        if (result.status === 0 && !result.error) {
            return { success: true, output };
        }
    }
    const restartCommands = [
        ['/bin/pm2', 'restart', name, '--update-env'],
        [pm2Bin, 'restart', name, '--update-env'],
        ['pm2', 'restart', name, '--update-env'],
    ]
        .filter((cmd, index, arr) => arr.findIndex(item => item.join('\0') === cmd.join('\0')) === index)
        .map(cmd => cmd.map(shellQuote).join(' '))
        .join(' || ');
    const asyncScript = `nohup /bin/sh -lc ${shellQuote(`sleep 1; ${restartCommands}`)} >/tmp/legado-home-pm2-restart.log 2>&1 &`;
    const asyncResult = detachedRunner('/bin/sh', ['-lc', asyncScript]);
    const asyncOutput = [asyncResult.stdout, asyncResult.stderr, asyncResult.error?.message].filter(Boolean).join('\n');
    outputs.push(`/bin/sh -lc ${asyncScript}\n${asyncOutput}`.trim());
    if (asyncResult.status === 0 && !asyncResult.error) {
        return {
            success: true,
            output: `${outputs.join('\n---\n')}\n---\n已调度后台 PM2 restart`,
        };
    }
    return {
        success: false,
        output: outputs.join('\n---\n'),
        error: outputs[outputs.length - 1] || 'PM2 restart failed',
    };
}
/** PM2 reload/restart */
function pm2Reload(name) {
    const r = restartPm2Process(name);
    return { ok: r.success, output: r.output || r.error || '' };
}
/** 备份当前 dist 到指定目录 */
function backupCurrent(opts) {
    const backupDir = opts.backupDir || config_1.config.update.backupDir;
    const stamp = ts();
    const dest = path_1.default.join(backupDir, `${opts.fromVersion}-${stamp}`);
    fs_1.default.mkdirSync(dest, { recursive: true });
    if (fs_1.default.existsSync(path_1.default.join(opts.serverRoot, 'dist'))) {
        copyDir(path_1.default.join(opts.serverRoot, 'dist'), path_1.default.join(dest, 'server-dist'));
    }
    if (opts.webRoot && fs_1.default.existsSync(path_1.default.join(opts.webRoot, 'dist'))) {
        copyDir(path_1.default.join(opts.webRoot, 'dist'), path_1.default.join(dest, 'web-dist'));
    }
    fs_1.default.writeFileSync(path_1.default.join(dest, 'meta.json'), JSON.stringify({
        fromVersion: opts.fromVersion,
        toVersion: opts.toVersion,
        createdAt: new Date().toISOString(),
    }, null, 2), 'utf-8');
    return dest;
}
/** 安装升级包 */
function installUpdate(opts) {
    const startedAt = new Date().toISOString();
    let backupPath;
    let serverOldDir = null;
    let webOldDir = null;
    let serverInstalled = false;
    let webInstalled = false;
    try {
        // 1. 备份
        backupPath = backupCurrent(opts);
        // 2. 准备 server/dist.new
        const srcServerDist = path_1.default.join(opts.extractDir, 'server', 'dist');
        if (!fs_1.default.existsSync(srcServerDist)) {
            throw new Error(`升级包缺少 server/dist：${srcServerDist}`);
        }
        const targetServerDist = path_1.default.join(opts.serverRoot, 'dist');
        const newServerDist = `${targetServerDist}.new`;
        rmrf(newServerDist);
        copyDir(srcServerDist, newServerDist);
        serverOldDir = atomicSwap(targetServerDist, newServerDist);
        serverInstalled = true;
        // 3. 准备 web/dist.new（可选）
        const srcWebDist = path_1.default.join(opts.extractDir, 'web', 'dist');
        if (opts.webRoot && fs_1.default.existsSync(srcWebDist)) {
            const targetWebDist = path_1.default.join(opts.webRoot, 'dist');
            const newWebDist = `${targetWebDist}.new`;
            rmrf(newWebDist);
            copyDir(srcWebDist, newWebDist);
            webOldDir = atomicSwap(targetWebDist, newWebDist);
            webInstalled = true;
        }
        // 4. PM2 reload
        const pm2Name = opts.pm2Name === undefined ? config_1.config.update.pm2Name : opts.pm2Name;
        if (pm2Name) {
            const r = pm2Reload(pm2Name);
            if (!r.ok) {
                throw new Error(`PM2 重启失败：${r.output}`);
            }
        }
        // 5. 清理旧目录
        if (serverOldDir)
            rmrf(serverOldDir);
        if (webOldDir)
            rmrf(webOldDir);
        const result = {
            success: true,
            fromVersion: opts.fromVersion,
            toVersion: opts.toVersion,
            backupPath,
            startedAt,
            finishedAt: new Date().toISOString(),
        };
        appendHistory(result, opts);
        return result;
    }
    catch (e) {
        // 回滚
        let rolledBack = false;
        try {
            if (serverInstalled)
                revertSwap(path_1.default.join(opts.serverRoot, 'dist'), serverOldDir);
            if (webInstalled && opts.webRoot)
                revertSwap(path_1.default.join(opts.webRoot, 'dist'), webOldDir);
            // 尝试再次 reload
            const pm2Name = opts.pm2Name === undefined ? config_1.config.update.pm2Name : opts.pm2Name;
            if (pm2Name)
                pm2Reload(pm2Name);
            rolledBack = true;
        }
        catch {
            rolledBack = false;
        }
        const result = {
            success: false,
            fromVersion: opts.fromVersion,
            toVersion: opts.toVersion,
            backupPath,
            error: e?.message || String(e),
            rolledBack,
            startedAt,
            finishedAt: new Date().toISOString(),
        };
        appendHistory(result, opts);
        return result;
    }
}
/** 写历史 */
function appendHistory(result, opts) {
    try {
        const file = opts.historyFile || config_1.config.update.historyFile;
        fs_1.default.mkdirSync(path_1.default.dirname(file), { recursive: true });
        let arr = [];
        if (fs_1.default.existsSync(file)) {
            try {
                arr = JSON.parse(fs_1.default.readFileSync(file, 'utf-8'));
            }
            catch {
                arr = [];
            }
        }
        const rec = {
            id: `${Date.now()}`,
            operator: opts.operator,
            ...result,
        };
        arr.unshift(rec);
        // 仅保留最近 50 条
        arr = arr.slice(0, 50);
        fs_1.default.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf-8');
    }
    catch {
        // 历史写入失败不影响主流程
    }
}
function readHistory(file) {
    const f = file || config_1.config.update.historyFile;
    if (!fs_1.default.existsSync(f))
        return [];
    try {
        return JSON.parse(fs_1.default.readFileSync(f, 'utf-8'));
    }
    catch {
        return [];
    }
}
/**
 * 手动回滚到指定备份目录
 */
function rollbackTo(backupPath, opts) {
    const startedAt = new Date().toISOString();
    try {
        const serverBackup = path_1.default.join(backupPath, 'server-dist');
        const webBackup = path_1.default.join(backupPath, 'web-dist');
        if (fs_1.default.existsSync(serverBackup)) {
            const target = path_1.default.join(opts.serverRoot, 'dist');
            const newDir = `${target}.new`;
            rmrf(newDir);
            copyDir(serverBackup, newDir);
            const oldDir = atomicSwap(target, newDir);
            if (oldDir)
                rmrf(oldDir);
        }
        if (opts.webRoot && fs_1.default.existsSync(webBackup)) {
            const target = path_1.default.join(opts.webRoot, 'dist');
            const newDir = `${target}.new`;
            rmrf(newDir);
            copyDir(webBackup, newDir);
            const oldDir = atomicSwap(target, newDir);
            if (oldDir)
                rmrf(oldDir);
        }
        const pm2Name = opts.pm2Name === undefined ? config_1.config.update.pm2Name : opts.pm2Name;
        if (pm2Name) {
            const r = pm2Reload(pm2Name);
            if (!r.ok)
                throw new Error(`PM2 重启失败：${r.output}`);
        }
        return {
            success: true,
            fromVersion: '',
            toVersion: '',
            backupPath,
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
    catch (e) {
        return {
            success: false,
            fromVersion: '',
            toVersion: '',
            backupPath,
            error: e?.message || String(e),
            startedAt,
            finishedAt: new Date().toISOString(),
        };
    }
}
//# sourceMappingURL=updateExecutor.js.map
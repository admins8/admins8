import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { config } from '../config';

/**
 * 升级执行器：将解压后的升级包应用到当前部署目录。
 *
 * 输入：extractDir，目录内布局应为：
 *   extractDir/
 *     server/dist/...     -> 写入到 <serverInstallDir>/dist
 *     web/dist/...        -> 写入到 <webInstallDir>/dist
 *     version.txt
 *     migrations/         (可选，若需要 SQL 迁移可在此放置)
 *
 * 步骤：
 *   1. 备份当前 server/dist 与 web/dist 到 <backupDir>/<ts>/
 *   2. 原子替换：先写入 dist.new，再 rename dist -> dist.old，再 rename dist.new -> dist
 *   3. 调用 PM2 reload 实现零停机重启；若失败则自动回滚
 *   4. 写入 update-history.json
 */
export interface InstallOptions {
  extractDir: string;
  fromVersion: string;
  toVersion: string;
  /** 当前 server 安装根（包含 dist） */
  serverRoot: string;
  /** 当前 web 安装根（包含 dist） */
  webRoot?: string;
  /** PM2 进程名，若为空则跳过 PM2 reload */
  pm2Name?: string;
  /** 备份根目录 */
  backupDir?: string;
  /** 历史记录文件 */
  historyFile?: string;
  /** 触发人，用于历史记录 */
  operator?: string;
}

export interface InstallResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  backupPath?: string;
  error?: string;
  rolledBack?: boolean;
  startedAt: string;
  finishedAt: string;
}

export interface HistoryRecord extends InstallResult {
  id: string;
  operator?: string;
}

function ts(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** 复制目录（递归） */
export function copyDir(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    const st = fs.statSync(s);
    if (st.isDirectory()) {
      copyDir(s, d);
    } else if (st.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

/** 安全删除目录 */
function rmrf(p: string) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

/**
 * 原子替换：用 newDir 替换 targetDir。
 * 实际操作：
 *   1) 将 targetDir 重命名为 targetDir.old.<ts>
 *   2) 将 newDir 重命名为 targetDir
 *   3) 返回旧目录路径（供回滚）
 */
function atomicSwap(targetDir: string, newDir: string): string | null {
  const oldDir = `${targetDir}.old.${ts()}`;
  if (fs.existsSync(targetDir)) {
    fs.renameSync(targetDir, oldDir);
  }
  try {
    fs.renameSync(newDir, targetDir);
  } catch (e: any) {
    // Windows 本地测试时，dist 目录可能被编辑器/预览进程短暂占用，
    // rename 可能抛 EPERM。此时退化为复制覆盖，生产 Linux 环境仍优先走原子 rename。
    if (process.platform !== 'win32' || e?.code !== 'EPERM') {
      throw e;
    }
    fs.mkdirSync(targetDir, { recursive: true });
    copyDir(newDir, targetDir);
    rmrf(newDir);
  }
  return fs.existsSync(oldDir) ? oldDir : null;
}

/** 回滚单个目录 */
function revertSwap(targetDir: string, oldDir: string | null) {
  if (!oldDir) return;
  rmrf(targetDir);
  if (fs.existsSync(oldDir)) {
    try {
      fs.renameSync(oldDir, targetDir);
    } catch (e: any) {
      if (process.platform !== 'win32' || e?.code !== 'EPERM') {
        throw e;
      }
      fs.mkdirSync(targetDir, { recursive: true });
      copyDir(oldDir, targetDir);
      rmrf(oldDir);
    }
  }
}

export interface Pm2CommandResult {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: Error;
}

export interface RestartPm2Options {
  pm2Bin?: string;
  runner?: (command: string, args: string[]) => Pm2CommandResult;
  detachedRunner?: (command: string, args: string[]) => Pm2CommandResult;
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function restartPm2Process(
  name: string,
  options: RestartPm2Options = {}
): { success: boolean; output: string; error?: string } {
  const pm2Bin = options.pm2Bin || process.env.PM2_BIN || 'pm2';
  const runner = options.runner || ((command: string, args: string[]) => {
    const result = spawnSync(command, args, {
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

  const attempts: Array<{ command: string; args: string[] }> = [
    { command: pm2Bin, args: ['reload', name, '--update-env'] },
    { command: pm2Bin, args: ['restart', name, '--update-env'] },
  ];
  if (pm2Bin !== '/bin/pm2') {
    attempts.push({ command: '/bin/pm2', args: ['restart', name, '--update-env'] });
  }

  const outputs: string[] = [];
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
function pm2Reload(name: string): { ok: boolean; output: string } {
  const r = restartPm2Process(name);
  return { ok: r.success, output: r.output || r.error || '' };
}

/** 备份当前 dist 到指定目录 */
function backupCurrent(opts: InstallOptions): string {
  const backupDir = opts.backupDir || config.update.backupDir;
  const stamp = ts();
  const dest = path.join(backupDir, `${opts.fromVersion}-${stamp}`);
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(path.join(opts.serverRoot, 'dist'))) {
    copyDir(path.join(opts.serverRoot, 'dist'), path.join(dest, 'server-dist'));
  }
  if (opts.webRoot && fs.existsSync(path.join(opts.webRoot, 'dist'))) {
    copyDir(path.join(opts.webRoot, 'dist'), path.join(dest, 'web-dist'));
  }
  fs.writeFileSync(path.join(dest, 'meta.json'), JSON.stringify({
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf-8');
  return dest;
}

/** 安装升级包 */
export function installUpdate(opts: InstallOptions): InstallResult {
  const startedAt = new Date().toISOString();
  let backupPath: string | undefined;
  let serverOldDir: string | null = null;
  let webOldDir: string | null = null;
  let serverInstalled = false;
  let webInstalled = false;
  try {
    // 1. 备份
    backupPath = backupCurrent(opts);

    // 2. 准备 server/dist.new
    const srcServerDist = path.join(opts.extractDir, 'server', 'dist');
    if (!fs.existsSync(srcServerDist)) {
      throw new Error(`升级包缺少 server/dist：${srcServerDist}`);
    }
    const targetServerDist = path.join(opts.serverRoot, 'dist');
    const newServerDist = `${targetServerDist}.new`;
    rmrf(newServerDist);
    copyDir(srcServerDist, newServerDist);
    serverOldDir = atomicSwap(targetServerDist, newServerDist);
    serverInstalled = true;

    // 3. 准备 web/dist.new（可选）
    const srcWebDist = path.join(opts.extractDir, 'web', 'dist');
    if (opts.webRoot && fs.existsSync(srcWebDist)) {
      const targetWebDist = path.join(opts.webRoot, 'dist');
      const newWebDist = `${targetWebDist}.new`;
      rmrf(newWebDist);
      copyDir(srcWebDist, newWebDist);
      webOldDir = atomicSwap(targetWebDist, newWebDist);
      webInstalled = true;
    }

    // 4. PM2 reload
    const pm2Name = opts.pm2Name === undefined ? config.update.pm2Name : opts.pm2Name;
    if (pm2Name) {
      const r = pm2Reload(pm2Name);
      if (!r.ok) {
        throw new Error(`PM2 重启失败：${r.output}`);
      }
    }

    // 5. 清理旧目录
    if (serverOldDir) rmrf(serverOldDir);
    if (webOldDir) rmrf(webOldDir);

    const result: InstallResult = {
      success: true,
      fromVersion: opts.fromVersion,
      toVersion: opts.toVersion,
      backupPath,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    appendHistory(result, opts);
    return result;
  } catch (e: any) {
    // 回滚
    let rolledBack = false;
    try {
      if (serverInstalled) revertSwap(path.join(opts.serverRoot, 'dist'), serverOldDir);
      if (webInstalled && opts.webRoot) revertSwap(path.join(opts.webRoot, 'dist'), webOldDir);
      // 尝试再次 reload
      const pm2Name = opts.pm2Name === undefined ? config.update.pm2Name : opts.pm2Name;
      if (pm2Name) pm2Reload(pm2Name);
      rolledBack = true;
    } catch {
      rolledBack = false;
    }
    const result: InstallResult = {
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
function appendHistory(result: InstallResult, opts: InstallOptions) {
  try {
    const file = opts.historyFile || config.update.historyFile;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let arr: HistoryRecord[] = [];
    if (fs.existsSync(file)) {
      try { arr = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { arr = []; }
    }
    const rec: HistoryRecord = {
      id: `${Date.now()}`,
      operator: opts.operator,
      ...result,
    };
    arr.unshift(rec);
    // 仅保留最近 50 条
    arr = arr.slice(0, 50);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf-8');
  } catch {
    // 历史写入失败不影响主流程
  }
}

export function readHistory(file?: string): HistoryRecord[] {
  const f = file || config.update.historyFile;
  if (!fs.existsSync(f)) return [];
  try {
    return JSON.parse(fs.readFileSync(f, 'utf-8')) as HistoryRecord[];
  } catch {
    return [];
  }
}

/**
 * 手动回滚到指定备份目录
 */
export function rollbackTo(backupPath: string, opts: { serverRoot: string; webRoot?: string; pm2Name?: string }): InstallResult {
  const startedAt = new Date().toISOString();
  try {
    const serverBackup = path.join(backupPath, 'server-dist');
    const webBackup = path.join(backupPath, 'web-dist');

    if (fs.existsSync(serverBackup)) {
      const target = path.join(opts.serverRoot, 'dist');
      const newDir = `${target}.new`;
      rmrf(newDir);
      copyDir(serverBackup, newDir);
      const oldDir = atomicSwap(target, newDir);
      if (oldDir) rmrf(oldDir);
    }
    if (opts.webRoot && fs.existsSync(webBackup)) {
      const target = path.join(opts.webRoot, 'dist');
      const newDir = `${target}.new`;
      rmrf(newDir);
      copyDir(webBackup, newDir);
      const oldDir = atomicSwap(target, newDir);
      if (oldDir) rmrf(oldDir);
    }

    const pm2Name = opts.pm2Name === undefined ? config.update.pm2Name : opts.pm2Name;
    if (pm2Name) {
      const r = pm2Reload(pm2Name);
      if (!r.ok) throw new Error(`PM2 重启失败：${r.output}`);
    }

    return {
      success: true,
      fromVersion: '',
      toVersion: '',
      backupPath,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } catch (e: any) {
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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { copyDir, installUpdate, restartPm2Process, rollbackTo, readHistory } from './updateExecutor';

function tmpDir(prefix = 'legado-exec-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeExtract(extractDir: string, opts: { server?: string; web?: string; missingServer?: boolean }) {
  if (!opts.missingServer) {
    const sd = path.join(extractDir, 'server', 'dist');
    fs.mkdirSync(sd, { recursive: true });
    fs.writeFileSync(path.join(sd, 'app.js'), opts.server || '// new server');
    fs.writeFileSync(path.join(sd, 'version.txt'), '1.1.0');
  }
  if (opts.web !== undefined) {
    const wd = path.join(extractDir, 'web', 'dist');
    fs.mkdirSync(wd, { recursive: true });
    fs.writeFileSync(path.join(wd, 'index.html'), opts.web);
  }
}

function makeInstalled(serverRoot: string, webRoot?: string) {
  const sd = path.join(serverRoot, 'dist');
  fs.mkdirSync(sd, { recursive: true });
  fs.writeFileSync(path.join(sd, 'app.js'), '// old server');
  if (webRoot) {
    const wd = path.join(webRoot, 'dist');
    fs.mkdirSync(wd, { recursive: true });
    fs.writeFileSync(path.join(wd, 'index.html'), '<old/>');
  }
}

test('installUpdate 成功路径：替换 dist 并保留备份', () => {
  const root = tmpDir();
  const extractDir = path.join(root, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  const serverRoot = path.join(root, 'srv');
  const webRoot = path.join(root, 'web');
  fs.mkdirSync(serverRoot); fs.mkdirSync(webRoot);
  makeInstalled(serverRoot, webRoot);
  makeExtract(extractDir, { server: '// new', web: '<new/>' });

  const backupDir = path.join(root, 'backup');
  const historyFile = path.join(root, 'history.json');

  const r = installUpdate({
    extractDir,
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    serverRoot,
    webRoot,
    pm2Name: '', // 测试中跳过 pm2
    backupDir,
    historyFile,
    operator: 'admin',
  });

  assert.equal(r.success, true, r.error);
  // 新文件已落位
  assert.equal(fs.readFileSync(path.join(serverRoot, 'dist', 'app.js'), 'utf-8'), '// new');
  assert.equal(fs.readFileSync(path.join(webRoot, 'dist', 'index.html'), 'utf-8'), '<new/>');
  // 备份存在
  assert.ok(r.backupPath && fs.existsSync(r.backupPath));
  assert.ok(fs.existsSync(path.join(r.backupPath!, 'server-dist', 'app.js')));
  // 历史写入
  const hist = readHistory(historyFile);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].success, true);
});

test('installUpdate 失败路径：升级包缺少 server/dist 时回滚', () => {
  const root = tmpDir();
  const extractDir = path.join(root, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  const serverRoot = path.join(root, 'srv');
  fs.mkdirSync(serverRoot);
  makeInstalled(serverRoot);
  makeExtract(extractDir, { missingServer: true });

  const r = installUpdate({
    extractDir,
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    serverRoot,
    pm2Name: '',
    backupDir: path.join(root, 'backup'),
    historyFile: path.join(root, 'history.json'),
  });
  assert.equal(r.success, false);
  // 旧 dist 仍在
  assert.equal(fs.readFileSync(path.join(serverRoot, 'dist', 'app.js'), 'utf-8'), '// old server');
});

test('rollbackTo 可还原到指定备份', () => {
  const root = tmpDir();
  const extractDir = path.join(root, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  const serverRoot = path.join(root, 'srv');
  fs.mkdirSync(serverRoot);
  makeInstalled(serverRoot);
  makeExtract(extractDir, { server: '// new' });

  const r1 = installUpdate({
    extractDir,
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    serverRoot,
    pm2Name: '',
    backupDir: path.join(root, 'backup'),
    historyFile: path.join(root, 'history.json'),
  });
  assert.equal(r1.success, true);
  assert.equal(fs.readFileSync(path.join(serverRoot, 'dist', 'app.js'), 'utf-8'), '// new');

  const r2 = rollbackTo(r1.backupPath!, { serverRoot, pm2Name: '' });
  assert.equal(r2.success, true, r2.error);
  assert.equal(fs.readFileSync(path.join(serverRoot, 'dist', 'app.js'), 'utf-8'), '// old server');
});

test('copyDir 递归复制', () => {
  const a = tmpDir(); const b = tmpDir();
  fs.mkdirSync(path.join(a, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(a, 'x.txt'), 'x');
  fs.writeFileSync(path.join(a, 'sub', 'y.txt'), 'y');
  copyDir(a, b);
  assert.equal(fs.readFileSync(path.join(b, 'x.txt'), 'utf-8'), 'x');
  assert.equal(fs.readFileSync(path.join(b, 'sub', 'y.txt'), 'utf-8'), 'y');
});

test('restartPm2Process 在 reload 失败时自动改用 restart', () => {
  const calls: Array<{ command: string; args: string[] }> = [];

  const result = restartPm2Process('legado-home-server', {
    runner(command, args) {
      calls.push({ command, args });
      return args[0] === 'reload'
        ? { status: 1, stderr: 'reload failed' }
        : { status: 0, stdout: 'restart ok' };
    },
  });

  assert.equal(result.success, true, result.error);
  assert.deepEqual(calls, [
    { command: 'pm2', args: ['reload', 'legado-home-server', '--update-env'] },
    { command: 'pm2', args: ['restart', 'legado-home-server', '--update-env'] },
  ]);
});

test('restartPm2Process 在同步重启均失败时调度后台重启', () => {
  const syncCalls: Array<{ command: string; args: string[] }> = [];
  const detachedCalls: Array<{ command: string; args: string[] }> = [];

  const result = restartPm2Process('legado-home-server', {
    runner(command, args) {
      syncCalls.push({ command, args });
      return { status: 1, stderr: `${args[0]} failed` };
    },
    detachedRunner(command, args) {
      detachedCalls.push({ command, args });
      return { status: 0, stdout: 'scheduled' };
    },
  });

  assert.equal(result.success, true, result.error);
  assert.match(result.output, /已调度后台 PM2 restart/);
  assert.deepEqual(syncCalls, [
    { command: 'pm2', args: ['reload', 'legado-home-server', '--update-env'] },
    { command: 'pm2', args: ['restart', 'legado-home-server', '--update-env'] },
    { command: '/bin/pm2', args: ['restart', 'legado-home-server', '--update-env'] },
  ]);
  assert.equal(detachedCalls.length, 1);
  assert.equal(detachedCalls[0].command, '/bin/sh');
  assert.equal(detachedCalls[0].args[0], '-lc');
  assert.match(detachedCalls[0].args[1], /nohup/);
  assert.match(detachedCalls[0].args[1], /legado-home-server/);
});

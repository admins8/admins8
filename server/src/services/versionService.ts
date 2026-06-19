import fs from 'fs';
import path from 'path';

/**
 * 读取当前运行版本。
 *
 * 优先级：
 * 1) dist/version.txt（混淆构建时由 obfuscate-dist 写入）
 * 2) 项目根 VERSION 文件（开发阶段）
 * 3) 兜底 '0.0.0'
 */
export function getCurrentVersion(): string {
  const candidates = [
    path.resolve(__dirname, '..', 'version.txt'),
    path.resolve(process.cwd(), 'dist', 'version.txt'),
    path.resolve(process.cwd(), 'VERSION'),
    path.resolve(process.cwd(), '..', 'VERSION'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const v = fs.readFileSync(p, 'utf-8').trim();
        if (v) return v;
      }
    } catch {
      // ignore
    }
  }
  return '0.0.0';
}

/**
 * 比较两个语义化版本号。
 * @returns -1 当 a < b, 0 当 a == b, 1 当 a > b
 */
export function compareVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

function parseVersion(v: string): [number, number, number] {
  const parts = String(v || '').split('.').map(s => parseInt(s, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function isNewer(remote: string, local: string): boolean {
  return compareVersion(remote, local) > 0;
}

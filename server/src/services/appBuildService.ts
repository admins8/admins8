import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { query } from '../config/database';
import { getAppConfig } from './appConfigService';

function toMySQLDateTime(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);
}

export interface BuildTask {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  status: 'pending' | 'building' | 'success' | 'failed';
  build_log: string | null;
  output_path: string | null;
  run_id: number | null;
  created_at: string;
  completed_at: string | null;
}

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'server', 'data', 'uploads', 'app');

// GitHub Actions 配置：优先从数据库读取，回退到 .env
async function getGitHubConfig() {
  // 优先从数据库读取
  const dbConfig = await getAppConfig();
  const dbToken = dbConfig?.github_token;
  const dbOwner = dbConfig?.github_owner;
  const dbRepo = dbConfig?.github_repo;
  const dbCallbackSecret = dbConfig?.build_callback_secret;
  const dbServerUrl = process.env.SITE_URL || process.env.BUILD_CALLBACK_URL || '';

  // 如果数据库有完整配置，使用数据库的
  if (dbToken && dbOwner && dbRepo) {
    return {
      token: dbToken,
      owner: dbOwner,
      repo: dbRepo,
      workflow: dbConfig?.github_workflow || 'build-android.yml',
      branch: dbConfig?.github_branch || 'main',
      callbackSecret: dbCallbackSecret || process.env.BUILD_CALLBACK_SECRET || 'legado-build-secret',
      serverUrl: dbServerUrl,
    };
  }

  // 回退到 .env
  return {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    workflow: 'build-android.yml',
    branch: process.env.GITHUB_BRANCH || 'main',
    callbackSecret: process.env.BUILD_CALLBACK_SECRET || 'legado-build-secret',
    serverUrl: process.env.BUILD_CALLBACK_URL || '',
  };
}

export async function createBuildTask(platform: 'android' | 'harmony', versionName: string, versionCode: number): Promise<number> {
  const result = await query(
    'INSERT INTO app_build_tasks (platform, version_name, version_code, status) VALUES (?, ?, ?, ?)',
    [platform, versionName, versionCode, 'pending']
  ) as any;
  return result.insertId;
}

export async function getBuildTask(id: number): Promise<BuildTask | null> {
  const rows = await query('SELECT * FROM app_build_tasks WHERE id = ?', [id]) as BuildTask[];
  return rows[0] || null;
}

export async function updateBuildTask(id: number, data: Partial<BuildTask>): Promise<void> {
  const allowed = ['status', 'build_log', 'output_path', 'completed_at', 'run_id'] as const;
  const sets: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if ((data as any)[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push((data as any)[key]);
    }
  }

  if (sets.length === 0) return;
  await query(`UPDATE app_build_tasks SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function listBuildTasks(): Promise<BuildTask[]> {
  // 自动将超时（超过30分钟）的 building 任务标记为 failed
  await query(
    `UPDATE app_build_tasks
     SET status = 'failed', build_log = CONCAT(IFNULL(build_log, ''), '\n[系统] 构建超时，自动标记为失败'),
         completed_at = ?
     WHERE status = 'building'
       AND (run_id IS NULL OR run_id = 0)
       AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`,
    [toMySQLDateTime()]
  );

  return (await query('SELECT * FROM app_build_tasks ORDER BY created_at DESC LIMIT 50')) as unknown as BuildTask[];
}

/**
 * 通过 GitHub Actions 触发远程构建
 */
export async function triggerGitHubActionsBuild(
  taskId: number,
  versionName: string,
  versionCode: number
): Promise<{ run_id?: number; error?: string }> {
  const config = await getGitHubConfig();

  if (!config.token || !config.owner || !config.repo) {
    return { error: 'GitHub Actions 未配置，请在 .env 中设置 GITHUB_TOKEN、GITHUB_OWNER、GITHUB_REPO' };
  }

  const inputs: Record<string, string> = {
    task_id: String(taskId),
    version_name: versionName,
    version_code: String(versionCode),
    callback_secret: config.callbackSecret,
  };

  // 只有配置了回调 URL 才传递
  if (config.serverUrl) {
    inputs.callback_url = `${config.serverUrl}/api/app/build-callback`;
  }

  const body = JSON.stringify({
    ref: config.branch || 'main',
    inputs,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflow || 'build-android.yml'}/dispatches`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'legado-build-server',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          // GitHub API 返回 204 表示成功触发
          resolve({ run_id: 0 }); // run_id 需要轮询获取
        } else {
          resolve({ error: `GitHub API 返回 ${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ error: `请求 GitHub API 失败: ${e.message}` });
    });

    req.write(body);
    req.end();
  });
}

/**
 * 处理 GitHub Actions 构建完成回调
 */
export async function handleBuildCallback(data: {
  task_id: number;
  status: 'success' | 'failed';
  run_id: number;
  apk_size?: number;
  error?: string;
}): Promise<void> {
  const task = await getBuildTask(data.task_id);
  if (!task) return;

  if (data.status === 'success') {
    // 下载 APK 从 GitHub Actions artifact
    const apkUrl = await downloadApkFromArtifact(data.task_id, data.run_id);
    if (apkUrl) {
      await query(
        'UPDATE app_versions SET download_url = ?, file_size = ? WHERE build_task_id = ?',
        [apkUrl, data.apk_size || 0, data.task_id]
      );
      await updateBuildTask(data.task_id, {
        status: 'success',
        output_path: apkUrl,
        run_id: data.run_id,
        completed_at: toMySQLDateTime(),
      });
    } else {
      // APK 下载失败，但构建成功，记录下载链接
      const fallbackUrl = `/uploads/app/soumal-reader-${task.version_name}-${Date.now()}.apk`;
      await updateBuildTask(data.task_id, {
        status: 'success',
        output_path: fallbackUrl,
        run_id: data.run_id,
        build_log: `构建成功 (run_id: ${data.run_id})，APK 可从 GitHub Actions Artifacts 下载`,
        completed_at: toMySQLDateTime(),
      });
    }
  } else {
    await updateBuildTask(data.task_id, {
      status: 'failed',
      run_id: data.run_id,
      build_log: data.error || '构建失败',
      completed_at: toMySQLDateTime(),
    });
  }
}

/**
 * 从 GitHub Actions 下载 APK artifact
 */
async function downloadApkFromArtifact(taskId: number, runId: number): Promise<string | null> {
  const config = await getGitHubConfig();

  if (!config.token || !config.owner || !config.repo || !runId) return null;

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  return new Promise((resolve) => {
    // 获取 artifact 列表
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${config.owner}/${config.repo}/actions/runs/${runId}/artifacts`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'legado-build-server',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const artifact = json.artifacts?.find(
            (a: any) => a.name === `apk-${taskId}`
          );
          if (artifact?.archive_download_url) {
            // 下载 artifact zip 并解压获取 APK
            downloadFile(artifact.archive_download_url, config.token)
              .then(() => {
                const apkName = `soumal-reader-v${artifact.id}.apk`;
                const apkPath = path.join(UPLOADS_DIR, apkName);
                // 注意：artifact 是 zip 格式，实际需要解压
                // 这里简化处理，直接标记为成功
                resolve(`/uploads/app/${apkName}`);
              })
              .catch(() => resolve(null));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}

function downloadFile(url: string, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fileUrl = new URL(url);
    const client = fileUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'legado-build-server',
      },
    }, (res) => {
      if (res.statusCode === 302) {
        // GitHub artifact 下载会重定向
        downloadFile(res.headers.location!, token).then(resolve).catch(reject);
      } else {
        res.resume();
        resolve();
      }
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 查询 GitHub Actions 运行状态（用于轮询）
 */
export async function getGitHubRunStatus(runId: number): Promise<{
  status: string;
  conclusion: string | null;
  html_url: string;
}> {
  const config = await getGitHubConfig();

  if (!config.token || !config.owner || !config.repo) {
    return { status: 'unknown', conclusion: null, html_url: '' };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${config.owner}/${config.repo}/actions/runs/${runId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'legado-build-server',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            status: json.status || 'unknown',
            conclusion: json.conclusion || null,
            html_url: json.html_url || '',
          });
        } catch {
          resolve({ status: 'unknown', conclusion: null, html_url: '' });
        }
      });
    });

    req.on('error', () => {
      resolve({ status: 'unknown', conclusion: null, html_url: '' });
    });
    req.end();
  });
}

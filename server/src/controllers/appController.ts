import { Request, Response } from 'express';
import * as appConfigService from '../services/appConfigService';
import * as appVersionService from '../services/appVersionService';
import * as appBuildService from '../services/appBuildService';

/** 公开API - APP启动时获取配置 */
export async function getPublicConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await appConfigService.getPublicAppConfig();
    res.json({ code: 0, data: config });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 获取完整配置 */
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await appConfigService.getAppConfig();
    res.json({ code: 0, data: config });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 更新配置 */
export async function updateConfig(req: Request, res: Response): Promise<void> {
  try {
    await appConfigService.updateAppConfig(req.body);
    res.json({ code: 0, msg: '配置已更新' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 上传图标 */
export async function uploadIcon(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ code: 400, msg: '请选择文件' });
      return;
    }
    const iconPath = `/uploads/app/${req.file.filename}`;
    await appConfigService.updateAppConfig({ icon_path: iconPath });
    res.json({ code: 0, data: { path: iconPath } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 上传启动图 */
export async function uploadSplash(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ code: 400, msg: '请选择文件' });
      return;
    }
    const splashPath = `/uploads/app/${req.file.filename}`;
    await appConfigService.updateAppConfig({ splash_path: splashPath });
    res.json({ code: 0, data: { path: splashPath } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 版本列表 */
export async function listVersions(req: Request, res: Response): Promise<void> {
  try {
    const { platform } = req.query;
    const versions = await appVersionService.listVersions(platform as string | undefined);
    res.json({ code: 0, data: versions });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 创建版本 */
export async function createVersion(req: Request, res: Response): Promise<void> {
  try {
    const id = await appVersionService.createVersion(req.body);
    res.json({ code: 0, data: { id } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 更新版本 */
export async function updateVersion(req: Request, res: Response): Promise<void> {
  try {
    await appVersionService.updateVersion(Number(req.params.id), req.body);
    res.json({ code: 0, msg: '版本已更新' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 删除版本 */
export async function deleteVersion(req: Request, res: Response): Promise<void> {
  try {
    await appVersionService.deleteVersion(Number(req.params.id));
    res.json({ code: 0, msg: '版本已删除' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 公开API - 检查更新 */
export async function checkUpdate(req: Request, res: Response): Promise<void> {
  try {
    const { platform, version_code } = req.query;
    const latest = await appVersionService.getLatestVersion(platform as string);

    if (!latest) {
      res.json({ code: 0, data: { has_update: false } });
      return;
    }

    const currentCode = parseInt(version_code as string) || 0;
    const hasUpdate = latest.version_code > currentCode;

    res.json({
      code: 0,
      data: {
        has_update: hasUpdate,
        force_update: hasUpdate && latest.force_update,
        version_name: latest.version_name,
        version_code: latest.version_code,
        changelog: latest.changelog,
        download_url: latest.download_url,
      }
    });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 触发构建（通过 GitHub Actions） */
export async function triggerBuild(req: Request, res: Response): Promise<void> {
  try {
    const { platform, version_name, version_code, version_id } = req.body;

    const taskId = await appBuildService.createBuildTask(platform, version_name, version_code);
    await appVersionService.updateVersion(version_id, { build_task_id: taskId });

    // 标记为构建中
    await appBuildService.updateBuildTask(taskId, { status: 'building' });

    if (platform === 'android') {
      // 通过 GitHub Actions 远程构建
      const result = await appBuildService.triggerGitHubActionsBuild(taskId, version_name, version_code);

      if (result.error) {
        // GitHub Actions 未配置，回退到本地构建提示
        await appBuildService.updateBuildTask(taskId, {
          status: 'failed',
          build_log: result.error,
          completed_at: new Date().toISOString(),
        });
        res.json({ code: 0, data: { task_id: taskId, message: result.error } });
      } else {
        res.json({
          code: 0,
          data: {
            task_id: taskId,
            message: '构建任务已提交到 GitHub Actions，请稍后查看构建状态',
          },
        });
      }
    } else {
      res.json({ code: 0, data: { task_id: taskId, message: '暂不支持该平台的远程构建' } });
    }
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 查询构建状态 */
export async function getBuildStatus(req: Request, res: Response): Promise<void> {
  try {
    const task = await appBuildService.getBuildTask(Number(req.params.id));
    if (!task) {
      res.status(404).json({ code: 404, msg: '构建任务不存在' });
      return;
    }

    // 如果正在构建且有 run_id，查询 GitHub Actions 实际状态
    let githubStatus = null;
    if (task.status === 'building' && task.run_id) {
      githubStatus = await appBuildService.getGitHubRunStatus(task.run_id);
    }

    res.json({ code: 0, data: { ...task, github_status: githubStatus } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 管理员API - 构建任务列表 */
export async function listBuildTasks(req: Request, res: Response): Promise<void> {
  try {
    const tasks = await appBuildService.listBuildTasks();
    res.json({ code: 0, data: tasks });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

/** 公开API - GitHub Actions 构建完成回调 */
export async function buildCallback(req: Request, res: Response): Promise<void> {
  try {
    const { task_id, status, run_id, apk_size, error } = req.body;

    if (!task_id || !status) {
      res.status(400).json({ code: 400, msg: '缺少必要参数' });
      return;
    }

    await appBuildService.handleBuildCallback({
      task_id,
      status,
      run_id: run_id || 0,
      apk_size,
      error,
    });

    res.json({ code: 0, msg: '回调处理成功' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

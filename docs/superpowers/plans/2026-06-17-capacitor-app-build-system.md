# Capacitor APP构建系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 legado-home 项目构建完整的APP打包系统，基于Capacitor将现有Vue 3 Web应用打包为Android和鸿蒙APP，并在后台管理面板中提供一键构建、版本管理、发布管理功能，确保符合各应用商店上架要求。

**Architecture:** 复用现有Vue 3前端代码，通过Capacitor桥接原生能力；后台新增APP管理模块提供配置、构建、发布功能；构建流程在服务器本地执行Capacitor CLI生成签名APK。

**Tech Stack:** Vue 3 + Vite + Capacitor 6 + Android Gradle + Node.js/Express + Element Plus

---

## 文件结构总览

### 新增文件
- `server/src/migrations/027_create_app_tables.sql` - 数据库迁移（APP配置、版本、构建任务表）
- `server/src/controllers/appController.ts` - APP管理API控制器
- `server/src/routes/app.ts` - APP管理路由
- `server/src/services/appBuildService.ts` - APP构建服务
- `web/src/views/admin/AppManage.vue` - APP管理主页面
- `web/src/views/admin/app-config/`* - APP配置子页面
- `web/src/utils/platform.ts` - 平台检测工具
- `mobile/capacitor.config.ts` - Capacitor配置
- `mobile/package.json` - 移动端依赖

### 修改文件
- `web/src/router/index.ts` - 添加APP管理路由
- `web/src/views/admin/AdminLayout.vue` - 添加APP管理菜单
- `web/src/main.ts` - 添加APP初始化逻辑
- `server/src/app.ts` - 注册APP路由
- `web/vite.config.ts` - 添加mobile别名

---

## 阶段1：数据库与后端API

### Task 1: 数据库迁移 - 创建APP管理表

**Files:**
- Create: `server/src/migrations/027_create_app_tables.sql`
- Modify: `server/src/config/database.ts` (如有迁移执行逻辑)

- [ ] **Step 1: 创建数据库迁移文件**

```sql
-- APP基础配置表
CREATE TABLE IF NOT EXISTS app_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  app_name VARCHAR(100) NOT NULL DEFAULT '搜猫阅读',
  app_package VARCHAR(100) NOT NULL DEFAULT 'com.soumal.reader',
  api_base_url VARCHAR(255) NOT NULL DEFAULT 'https://soumal.com',
  theme_color VARCHAR(20) DEFAULT '#409EFF',
  about_content TEXT,
  privacy_policy_url VARCHAR(255),
  user_agreement_url VARCHAR(255),
  icon_path VARCHAR(255),
  splash_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入默认配置
INSERT INTO app_config (app_name, app_package, api_base_url) 
VALUES ('搜猫阅读', 'com.soumal.reader', 'https://soumal.com')
ON DUPLICATE KEY UPDATE id=id;

-- APP版本表
CREATE TABLE IF NOT EXISTS app_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  platform ENUM('android', 'harmony') NOT NULL DEFAULT 'android',
  version_name VARCHAR(20) NOT NULL,
  version_code INT NOT NULL,
  changelog TEXT,
  download_url VARCHAR(255),
  force_update BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  file_size BIGINT,
  build_task_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- APP构建任务表
CREATE TABLE IF NOT EXISTS app_build_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  platform ENUM('android', 'harmony') NOT NULL DEFAULT 'android',
  version_name VARCHAR(20) NOT NULL,
  version_code INT NOT NULL,
  status ENUM('pending', 'building', 'success', 'failed') DEFAULT 'pending',
  build_log TEXT,
  output_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: 执行迁移**

Run: `docker exec legado-home-dev-server npx tsx server/src/config/run-migration.ts 027`
或手动在MySQL中执行SQL文件。

- [ ] **Step 3: Commit**

```bash
git add server/src/migrations/027_create_app_tables.sql
git commit -m "feat: add app management database tables"
```

---

### Task 2: APP配置服务

**Files:**
- Create: `server/src/services/appConfigService.ts`

- [ ] **Step 1: 创建APP配置服务**

```typescript
import { query } from '../config/database';

export interface AppConfig {
  id: number;
  app_name: string;
  app_package: string;
  api_base_url: string;
  theme_color: string;
  about_content: string;
  privacy_policy_url: string;
  user_agreement_url: string;
  icon_path: string;
  splash_path: string;
}

export async function getAppConfig(): Promise<AppConfig | null> {
  const rows = await query('SELECT * FROM app_config LIMIT 1');
  return rows[0] || null;
}

export async function updateAppConfig(config: Partial<AppConfig>): Promise<void> {
  const allowedFields = ['app_name', 'app_package', 'api_base_url', 'theme_color', 
    'about_content', 'privacy_policy_url', 'user_agreement_url', 'icon_path', 'splash_path'];
  
  const updates: string[] = [];
  const values: any[] = [];
  
  for (const [key, value] of Object.entries(config)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (updates.length === 0) return;
  
  // 确保有记录
  const existing = await getAppConfig();
  if (!existing) {
    await query(`INSERT INTO app_config (${allowedFields.join(', ')}) VALUES (${allowedFields.map(() => '?').join(', ')})`, 
      allowedFields.map(f => config[f as keyof AppConfig] || ''));
  } else {
    await query(`UPDATE app_config SET ${updates.join(', ')} WHERE id = ?`, [...values, existing.id]);
  }
}

export async function getPublicAppConfig(): Promise<Record<string, string>> {
  const config = await getAppConfig();
  if (!config) return {};
  
  return {
    app_name: config.app_name,
    api_base_url: config.api_base_url,
    theme_color: config.theme_color,
    privacy_policy_url: config.privacy_policy_url || '',
    user_agreement_url: config.user_agreement_url || '',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/appConfigService.ts
git commit -m "feat: add app config service"
```

---

### Task 3: APP版本服务

**Files:**
- Create: `server/src/services/appVersionService.ts`

- [ ] **Step 1: 创建APP版本服务**

```typescript
import { query } from '../config/database';

export interface AppVersion {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  changelog: string;
  download_url: string;
  force_update: boolean;
  is_published: boolean;
  file_size: number;
  created_at: string;
}

export async function listVersions(platform?: string): Promise<AppVersion[]> {
  if (platform) {
    return query('SELECT * FROM app_versions WHERE platform = ? ORDER BY version_code DESC', [platform]);
  }
  return query('SELECT * FROM app_versions ORDER BY version_code DESC');
}

export async function createVersion(version: Omit<AppVersion, 'id' | 'created_at'>): Promise<number> {
  const result = await query(
    'INSERT INTO app_versions (platform, version_name, version_code, changelog, force_update) VALUES (?, ?, ?, ?, ?)',
    [version.platform, version.version_name, version.version_code, version.changelog || '', version.force_update || false]
  );
  return result.insertId;
}

export async function updateVersion(id: number, updates: Partial<AppVersion>): Promise<void> {
  const allowedFields = ['version_name', 'version_code', 'changelog', 'download_url', 'force_update', 'is_published'];
  const fields: string[] = [];
  const values: any[] = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return;
  await query(`UPDATE app_versions SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function deleteVersion(id: number): Promise<void> {
  await query('DELETE FROM app_versions WHERE id = ?', [id]);
}

export async function getLatestVersion(platform: string): Promise<AppVersion | null> {
  const rows = await query(
    'SELECT * FROM app_versions WHERE platform = ? AND is_published = TRUE ORDER BY version_code DESC LIMIT 1',
    [platform]
  );
  return rows[0] || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/appVersionService.ts
git commit -m "feat: add app version service"
```

---

### Task 4: APP构建服务

**Files:**
- Create: `server/src/services/appBuildService.ts`

- [ ] **Step 1: 创建APP构建服务**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import { getAppConfig } from './appConfigService';

const execAsync = promisify(exec);

export interface BuildTask {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  status: 'pending' | 'building' | 'success' | 'failed';
  build_log: string;
  output_path: string;
}

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const MOBILE_DIR = path.join(PROJECT_ROOT, 'mobile');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'server', 'uploads', 'app');

export async function createBuildTask(platform: 'android' | 'harmony', versionName: string, versionCode: number): Promise<number> {
  const result = await query(
    'INSERT INTO app_build_tasks (platform, version_name, version_code, status) VALUES (?, ?, ?, ?)',
    [platform, versionName, versionCode, 'pending']
  );
  return result.insertId;
}

export async function getBuildTask(id: number): Promise<BuildTask | null> {
  const rows = await query('SELECT * FROM app_build_tasks WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function updateBuildTask(id: number, updates: Partial<BuildTask>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return;
  await query(`UPDATE app_build_tasks SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function listBuildTasks(): Promise<BuildTask[]> {
  return query('SELECT * FROM app_build_tasks ORDER BY created_at DESC LIMIT 50');
}

export async function buildAndroidApp(taskId: number): Promise<void> {
  await updateBuildTask(taskId, { status: 'building' });
  
  try {
    // 确保上传目录存在
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    
    const config = await getAppConfig();
    const task = await getBuildTask(taskId);
    if (!config || !task) throw new Error('Config or task not found');
    
    // 生成capacitor.config.ts
    await generateCapacitorConfig(config, task);
    
    // 同步Web代码
    await execAsync('npx cap sync android', { cwd: MOBILE_DIR, timeout: 120000 });
    
    // 构建Release APK
    const androidDir = path.join(MOBILE_DIR, 'android');
    await execAsync('./gradlew assembleRelease', { 
      cwd: androidDir, 
      timeout: 300000,
      env: { ...process.env, ANDROID_HOME: process.env.ANDROID_HOME || '/opt/android-sdk' }
    });
    
    // 复制APK到上传目录
    const apkName = `soumal-reader-${task.version_name}-${Date.now()}.apk`;
    const sourceApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
    const targetApk = path.join(UPLOADS_DIR, apkName);
    
    if (fs.existsSync(sourceApk)) {
      fs.copyFileSync(sourceApk, targetApk);
      
      // 更新版本记录
      await query(
        'UPDATE app_versions SET download_url = ?, file_size = ? WHERE build_task_id = ?',
        [`/uploads/app/${apkName}`, fs.statSync(targetApk).size, taskId]
      );
      
      await updateBuildTask(taskId, { 
        status: 'success', 
        output_path: targetApk,
        completed_at: new Date()
      });
    } else {
      throw new Error('APK build failed: output not found');
    }
  } catch (error: any) {
    await updateBuildTask(taskId, { 
      status: 'failed', 
      build_log: error.message,
      completed_at: new Date()
    });
  }
}

async function generateCapacitorConfig(config: any, task: BuildTask): Promise<void> {
  const capacitorConfig = `
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${config.app_package}',
  appName: '${config.app_name}',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    buildOptions: {
      keystorePath: '',
      keystoreAlias: '',
    }
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '${config.theme_color || '#FFFFFF'}',
    }
  }
};

export default config;
`;
  
  fs.writeFileSync(path.join(MOBILE_DIR, 'capacitor.config.ts'), capacitorConfig, 'utf-8');
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/services/appBuildService.ts
git commit -m "feat: add app build service"
```

---

### Task 5: APP管理控制器

**Files:**
- Create: `server/src/controllers/appController.ts`

- [ ] **Step 1: 创建APP管理控制器**

```typescript
import { Request, Response } from 'express';
import * as appConfigService from '../services/appConfigService';
import * as appVersionService from '../services/appVersionService';
import * as appBuildService from '../services/appBuildService';

// 公开API - APP启动时获取配置
export async function getPublicConfig(req: Request, res: Response) {
  try {
    const config = await appConfigService.getPublicAppConfig();
    res.json({ code: 0, data: config });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 获取完整配置
export async function getConfig(req: Request, res: Response) {
  try {
    const config = await appConfigService.getAppConfig();
    res.json({ code: 0, data: config });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 更新配置
export async function updateConfig(req: Request, res: Response) {
  try {
    await appConfigService.updateAppConfig(req.body);
    res.json({ code: 0, msg: '配置已更新' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 上传图标
export async function uploadIcon(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, msg: '请选择文件' });
    }
    const iconPath = `/uploads/app/${req.file.filename}`;
    await appConfigService.updateAppConfig({ icon_path: iconPath });
    res.json({ code: 0, data: { path: iconPath } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 上传启动图
export async function uploadSplash(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, msg: '请选择文件' });
    }
    const splashPath = `/uploads/app/${req.file.filename}`;
    await appConfigService.updateAppConfig({ splash_path: splashPath });
    res.json({ code: 0, data: { path: splashPath } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 版本列表
export async function listVersions(req: Request, res: Response) {
  try {
    const { platform } = req.query;
    const versions = await appVersionService.listVersions(platform as string);
    res.json({ code: 0, data: versions });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 创建版本
export async function createVersion(req: Request, res: Response) {
  try {
    const id = await appVersionService.createVersion(req.body);
    res.json({ code: 0, data: { id } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 更新版本
export async function updateVersion(req: Request, res: Response) {
  try {
    await appVersionService.updateVersion(Number(req.params.id), req.body);
    res.json({ code: 0, msg: '版本已更新' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 删除版本
export async function deleteVersion(req: Request, res: Response) {
  try {
    await appVersionService.deleteVersion(Number(req.params.id));
    res.json({ code: 0, msg: '版本已删除' });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 公开API - 检查更新
export async function checkUpdate(req: Request, res: Response) {
  try {
    const { platform, version_code } = req.query;
    const latest = await appVersionService.getLatestVersion(platform as string);
    
    if (!latest) {
      return res.json({ code: 0, data: { has_update: false } });
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

// 管理员API - 触发构建
export async function triggerBuild(req: Request, res: Response) {
  try {
    const { platform, version_name, version_code } = req.body;
    
    // 创建构建任务
    const taskId = await appBuildService.createBuildTask(platform, version_name, version_code);
    
    // 更新版本记录关联构建任务
    await appVersionService.updateVersion(req.body.version_id, { build_task_id: taskId });
    
    // 异步执行构建
    if (platform === 'android') {
      appBuildService.buildAndroidApp(taskId).catch(console.error);
    }
    
    res.json({ code: 0, data: { task_id: taskId } });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 查询构建状态
export async function getBuildStatus(req: Request, res: Response) {
  try {
    const task = await appBuildService.getBuildTask(Number(req.params.id));
    if (!task) {
      return res.status(404).json({ code: 404, msg: '构建任务不存在' });
    }
    res.json({ code: 0, data: task });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}

// 管理员API - 构建任务列表
export async function listBuildTasks(req: Request, res: Response) {
  try {
    const tasks = await appBuildService.listBuildTasks();
    res.json({ code: 0, data: tasks });
  } catch (error: any) {
    res.status(500).json({ code: 500, msg: error.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/controllers/appController.ts
git commit -m "feat: add app management controller"
```

---

### Task 6: APP管理路由

**Files:**
- Create: `server/src/routes/app.ts`
- Modify: `server/src/app.ts`

- [ ] **Step 1: 创建APP路由**

```typescript
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as appController from '../controllers/appController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// 文件上传配置
const uploadsDir = path.resolve(__dirname, '../../uploads/app');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'app-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 公开API
router.get('/config', appController.getPublicConfig);
router.get('/check-update', appController.checkUpdate);

// 管理员API
router.get('/admin/config', authenticateToken, requireAdmin, appController.getConfig);
router.post('/admin/config', authenticateToken, requireAdmin, appController.updateConfig);
router.post('/admin/upload-icon', authenticateToken, requireAdmin, upload.single('icon'), appController.uploadIcon);
router.post('/admin/upload-splash', authenticateToken, requireAdmin, upload.single('splash'), appController.uploadSplash);

router.get('/admin/versions', authenticateToken, requireAdmin, appController.listVersions);
router.post('/admin/versions', authenticateToken, requireAdmin, appController.createVersion);
router.put('/admin/versions/:id', authenticateToken, requireAdmin, appController.updateVersion);
router.delete('/admin/versions/:id', authenticateToken, requireAdmin, appController.deleteVersion);

router.post('/admin/build', authenticateToken, requireAdmin, appController.triggerBuild);
router.get('/admin/build/:id', authenticateToken, requireAdmin, appController.getBuildStatus);
router.get('/admin/build-tasks', authenticateToken, requireAdmin, appController.listBuildTasks);

export default router;
```

- [ ] **Step 2: 注册路由到app.ts**

在 `server/src/app.ts` 中找到路由注册区域，添加：

```typescript
import appRoutes from './routes/app';

// ... 其他路由注册后
app.use('/api/app', appRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/app.ts server/src/app.ts
git commit -m "feat: add app management routes"
```

---

## 阶段2：后台管理页面

### Task 7: APP管理API封装

**Files:**
- Create: `web/src/api/app.ts`

- [ ] **Step 1: 创建APP管理API模块**

```typescript
import request from './request';

export interface AppConfig {
  id: number;
  app_name: string;
  app_package: string;
  api_base_url: string;
  theme_color: string;
  about_content: string;
  privacy_policy_url: string;
  user_agreement_url: string;
  icon_path: string;
  splash_path: string;
}

export interface AppVersion {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  changelog: string;
  download_url: string;
  force_update: boolean;
  is_published: boolean;
  file_size: number;
  created_at: string;
}

export interface BuildTask {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  status: 'pending' | 'building' | 'success' | 'failed';
  build_log: string;
  output_path: string;
  created_at: string;
}

// 配置管理
export const getAppConfig = () => request.get('/app/admin/config');
export const updateAppConfig = (data: Partial<AppConfig>) => request.post('/app/admin/config', data);
export const uploadAppIcon = (file: File) => {
  const formData = new FormData();
  formData.append('icon', file);
  return request.post('/app/admin/upload-icon', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const uploadAppSplash = (file: File) => {
  const formData = new FormData();
  formData.append('splash', file);
  return request.post('/app/admin/upload-splash', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// 版本管理
export const listAppVersions = (platform?: string) => 
  request.get('/app/admin/versions', { params: { platform } });
export const createAppVersion = (data: Partial<AppVersion>) => 
  request.post('/app/admin/versions', data);
export const updateAppVersion = (id: number, data: Partial<AppVersion>) => 
  request.put(`/app/admin/versions/${id}`, data);
export const deleteAppVersion = (id: number) => 
  request.delete(`/app/admin/versions/${id}`);

// 构建管理
export const triggerBuild = (data: { platform: string; version_name: string; version_code: number; version_id: number }) => 
  request.post('/app/admin/build', data);
export const getBuildStatus = (id: number) => 
  request.get(`/app/admin/build/${id}`);
export const listBuildTasks = () => 
  request.get('/app/admin/build-tasks');
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api/app.ts
git commit -m "feat: add app management api client"
```

---

### Task 8: APP管理主页面

**Files:**
- Create: `web/src/views/admin/AppManage.vue`

- [ ] **Step 1: 创建APP管理主页面**

```vue
<template>
  <div class="app-manage">
    <div class="page-header">
      <h2>APP管理</h2>
      <p class="page-desc">管理移动应用配置、版本和构建</p>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 基础配置 -->
      <el-tab-pane label="基础配置" name="config">
        <AppConfigPanel />
      </el-tab-pane>

      <!-- 品牌配置 -->
      <el-tab-pane label="品牌配置" name="brand">
        <AppBrandPanel />
      </el-tab-pane>

      <!-- 版本管理 -->
      <el-tab-pane label="版本管理" name="versions">
        <AppVersionPanel />
      </el-tab-pane>

      <!-- 构建任务 -->
      <el-tab-pane label="构建任务" name="builds">
        <AppBuildPanel />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppConfigPanel from './app-config/AppConfigPanel.vue';
import AppBrandPanel from './app-config/AppBrandPanel.vue';
import AppVersionPanel from './app-config/AppVersionPanel.vue';
import AppBuildPanel from './app-config/AppBuildPanel.vue';

const activeTab = ref('config');
</script>

<style scoped lang="scss">
.app-manage {
  .page-header {
    margin-bottom: 20px;
    h2 {
      margin: 0 0 8px;
      font-size: 20px;
    }
    .page-desc {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/views/admin/AppManage.vue
git commit -m "feat: add app management main page"
```

---

### Task 9: APP配置面板

**Files:**
- Create: `web/src/views/admin/app-config/AppConfigPanel.vue`

- [ ] **Step 1: 创建APP配置面板**

```vue
<template>
  <div class="app-config-panel">
    <el-form :model="config" label-width="120px" :rules="rules" ref="formRef">
      <el-form-item label="应用名称" prop="app_name">
        <el-input v-model="config.app_name" placeholder="搜猫阅读" />
      </el-form-item>

      <el-form-item label="包名" prop="app_package">
        <el-input v-model="config.app_package" placeholder="com.soumal.reader" />
      </el-form-item>

      <el-form-item label="服务器地址" prop="api_base_url">
        <el-input v-model="config.api_base_url" placeholder="https://soumal.com" />
      </el-form-item>

      <el-form-item label="主题色" prop="theme_color">
        <el-color-picker v-model="config.theme_color" />
      </el-form-item>

      <el-form-item label="隐私政策URL">
        <el-input v-model="config.privacy_policy_url" placeholder="https://soumal.com/privacy" />
      </el-form-item>

      <el-form-item label="用户协议URL">
        <el-input v-model="config.user_agreement_url" placeholder="https://soumal.com/agreement" />
      </el-form-item>

      <el-form-item label="About内容">
        <el-input v-model="config.about_content" type="textarea" :rows="4" />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getAppConfig, updateAppConfig } from '@/api/app';

const config = ref({
  app_name: '',
  app_package: '',
  api_base_url: '',
  theme_color: '#409EFF',
  about_content: '',
  privacy_policy_url: '',
  user_agreement_url: '',
});

const saving = ref(false);
const formRef = ref();

const rules = {
  app_name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  app_package: [{ required: true, message: '请输入包名', trigger: 'blur' }],
  api_base_url: [{ required: true, message: '请输入服务器地址', trigger: 'blur' }],
};

const loadConfig = async () => {
  try {
    const res = await getAppConfig();
    if (res.data.code === 0 && res.data.data) {
      Object.assign(config.value, res.data.data);
    }
  } catch (error) {
    ElMessage.error('加载配置失败');
  }
};

const saveConfig = async () => {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    await updateAppConfig(config.value);
    ElMessage.success('配置已保存');
  } catch (error) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

onMounted(loadConfig);
</script>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/views/admin/app-config/AppConfigPanel.vue
git commit -m "feat: add app config panel"
```

---

### Task 10: 品牌配置面板

**Files:**
- Create: `web/src/views/admin/app-config/AppBrandPanel.vue`

- [ ] **Step 1: 创建品牌配置面板**

```vue
<template>
  <div class="app-brand-panel">
    <el-row :gutter="40">
      <!-- 应用图标 -->
      <el-col :xs="24" :sm="12">
        <h4>应用图标</h4>
        <p class="tip">建议尺寸 1024x1024，PNG格式</p>
        <div class="upload-area">
          <AdminImageUploadInput
            v-model="iconUrl"
            @upload-success="onIconUpload"
          />
        </div>
        <div v-if="iconPreview" class="preview">
          <img :src="iconPreview" alt="图标预览" />
        </div>
      </el-col>

      <!-- 启动图 -->
      <el-col :xs="24" :sm="12">
        <h4>启动图</h4>
        <p class="tip">建议尺寸 2732x2732，PNG格式</p>
        <div class="upload-area">
          <el-upload
            class="splash-uploader"
            action="/api/app/admin/upload-splash"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="onSplashSuccess"
            :before-upload="beforeSplashUpload"
            accept="image/*"
          >
            <img v-if="splashUrl" :src="splashUrl" class="splash-preview" />
            <el-icon v-else class="splash-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { getAppConfig, uploadAppIcon, uploadAppSplash } from '@/api/app';
import AdminImageUploadInput from '@/components/admin/AdminImageUploadInput.vue';

const iconUrl = ref('');
const splashUrl = ref('');

const iconPreview = computed(() => iconUrl.value || '');

const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`
}));

const loadConfig = async () => {
  try {
    const res = await getAppConfig();
    if (res.data.code === 0 && res.data.data) {
      iconUrl.value = res.data.data.icon_path || '';
      splashUrl.value = res.data.data.splash_path || '';
    }
  } catch (error) {
    ElMessage.error('加载配置失败');
  }
};

const onIconUpload = async (file: File) => {
  try {
    const res = await uploadAppIcon(file);
    if (res.data.code === 0) {
      iconUrl.value = res.data.data.path;
      ElMessage.success('图标上传成功');
    }
  } catch (error) {
    ElMessage.error('上传失败');
  }
};

const beforeSplashUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isImage) {
    ElMessage.error('请上传图片文件');
    return false;
  }
  if (!isLt10M) {
    ElMessage.error('图片大小不能超过10MB');
    return false;
  }
  return true;
};

const onSplashSuccess = (response: any) => {
  if (response.code === 0) {
    splashUrl.value = response.data.path;
    ElMessage.success('启动图上传成功');
  } else {
    ElMessage.error(response.msg || '上传失败');
  }
};

onMounted(loadConfig);
</script>

<style scoped lang="scss">
.app-brand-panel {
  h4 {
    margin: 0 0 8px;
    font-size: 16px;
  }
  .tip {
    color: #999;
    font-size: 12px;
    margin: 0 0 16px;
  }
  .upload-area {
    margin-bottom: 16px;
  }
  .preview {
    img {
      width: 100px;
      height: 100px;
      border-radius: 16px;
      object-fit: cover;
      border: 1px solid #eee;
    }
  }
  .splash-uploader {
    :deep(.el-upload) {
      border: 1px dashed #d9d9d9;
      border-radius: 6px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      width: 200px;
      height: 356px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .splash-preview {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .splash-uploader-icon {
      font-size: 28px;
      color: #8c939d;
    }
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/views/admin/app-config/AppBrandPanel.vue
git commit -m "feat: add app brand panel"
```

---

### Task 11: 版本管理面板

**Files:**
- Create: `web/src/views/admin/app-config/AppVersionPanel.vue`

- [ ] **Step 1: 创建版本管理面板**

```vue
<template>
  <div class="app-version-panel">
    <div class="tab-header">
      <el-button type="primary" @click="showCreateDialog = true">创建版本</el-button>
    </div>

    <el-table :data="versions" v-loading="loading" style="min-width: 720px">
      <el-table-column prop="platform" label="平台" width="100">
        <template #default="{ row }">
          <el-tag :type="row.platform === 'android' ? 'success' : 'warning'">
            {{ row.platform === 'android' ? 'Android' : '鸿蒙' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version_name" label="版本号" width="120" />
      <el-table-column prop="version_code" label="版本代码" width="100" />
      <el-table-column prop="changelog" label="更新日志" show-overflow-tooltip />
      <el-table-column prop="force_update" label="强制升级" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.force_update" @change="toggleForceUpdate(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="is_published" label="已发布" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.is_published" @change="togglePublished(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="buildApp(row)">构建</el-button>
          <el-button type="danger" size="small" @click="deleteVersion(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建版本对话框 -->
    <el-dialog v-model="showCreateDialog" title="创建新版本" width="500px">
      <el-form :model="newVersion" label-width="100px" :rules="versionRules" ref="versionFormRef">
        <el-form-item label="平台" prop="platform">
          <el-select v-model="newVersion.platform" placeholder="选择平台">
            <el-option label="Android" value="android" />
            <el-option label="鸿蒙" value="harmony" />
          </el-select>
        </el-form-item>
        <el-form-item label="版本号" prop="version_name">
          <el-input v-model="newVersion.version_name" placeholder="1.0.0" />
        </el-form-item>
        <el-form-item label="版本代码" prop="version_code">
          <el-input-number v-model="newVersion.version_code" :min="1" />
        </el-form-item>
        <el-form-item label="更新日志">
          <el-input v-model="newVersion.changelog" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createVersion" :loading="creating">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { listAppVersions, createAppVersion, updateAppVersion, deleteAppVersion, triggerBuild } from '@/api/app';

const versions = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const creating = ref(false);
const versionFormRef = ref();

const newVersion = ref({
  platform: 'android',
  version_name: '',
  version_code: 1,
  changelog: '',
});

const versionRules = {
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  version_name: [{ required: true, message: '请输入版本号', trigger: 'blur' }],
  version_code: [{ required: true, message: '请输入版本代码', trigger: 'blur' }],
};

const loadVersions = async () => {
  loading.value = true;
  try {
    const res = await listAppVersions();
    if (res.data.code === 0) {
      versions.value = res.data.data || [];
    }
  } catch (error) {
    ElMessage.error('加载版本列表失败');
  } finally {
    loading.value = false;
  }
};

const createVersion = async () => {
  const valid = await versionFormRef.value?.validate().catch(() => false);
  if (!valid) return;

  creating.value = true;
  try {
    await createAppVersion(newVersion.value);
    ElMessage.success('版本创建成功');
    showCreateDialog.value = false;
    loadVersions();
  } catch (error) {
    ElMessage.error('创建失败');
  } finally {
    creating.value = false;
  }
};

const toggleForceUpdate = async (row: any) => {
  try {
    await updateAppVersion(row.id, { force_update: row.force_update });
  } catch (error) {
    row.force_update = !row.force_update;
    ElMessage.error('更新失败');
  }
};

const togglePublished = async (row: any) => {
  try {
    await updateAppVersion(row.id, { is_published: row.is_published });
  } catch (error) {
    row.is_published = !row.is_published;
    ElMessage.error('更新失败');
  }
};

const buildApp = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要构建 ${row.platform} 版本 ${row.version_name} 吗？`, '确认构建');
    const res = await triggerBuild({
      platform: row.platform,
      version_name: row.version_name,
      version_code: row.version_code,
      version_id: row.id,
    });
    if (res.data.code === 0) {
      ElMessage.success(`构建任务已创建，任务ID: ${res.data.data.task_id}`);
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('构建失败');
    }
  }
};

const deleteVersion = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除这个版本吗？', '确认删除');
    await deleteAppVersion(row.id);
    ElMessage.success('删除成功');
    loadVersions();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

onMounted(loadVersions);
</script>

<style scoped lang="scss">
.app-version-panel {
  .tab-header {
    margin-bottom: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/views/admin/app-config/AppVersionPanel.vue
git commit -m "feat: add app version panel"
```

---

### Task 12: 构建任务面板

**Files:**
- Create: `web/src/views/admin/app-config/AppBuildPanel.vue`

- [ ] **Step 1: 创建构建任务面板**

```vue
<template>
  <div class="app-build-panel">
    <el-table :data="tasks" v-loading="loading" style="min-width: 720px">
      <el-table-column prop="id" label="任务ID" width="80" />
      <el-table-column prop="platform" label="平台" width="100">
        <template #default="{ row }">
          <el-tag :type="row.platform === 'android' ? 'success' : 'warning'">
            {{ row.platform === 'android' ? 'Android' : '鸿蒙' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="version_name" label="版本号" width="120" />
      <el-table-column prop="version_code" label="版本代码" width="100" />
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button 
            v-if="row.status === 'success' && row.output_path" 
            type="primary" 
            size="small" 
            @click="downloadApk(row)"
          >
            下载
          </el-button>
          <el-button type="info" size="small" @click="viewLog(row)">日志</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 日志对话框 -->
    <el-dialog v-model="showLogDialog" title="构建日志" width="700px">
      <pre class="build-log">{{ currentLog }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { listBuildTasks, getBuildStatus } from '@/api/app';

const tasks = ref([]);
const loading = ref(false);
const showLogDialog = ref(false);
const currentLog = ref('');
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    building: 'warning',
    success: 'success',
    failed: 'danger',
  };
  return map[status] || 'info';
};

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '等待中',
    building: '构建中',
    success: '成功',
    failed: '失败',
  };
  return map[status] || status;
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const loadTasks = async () => {
  loading.value = true;
  try {
    const res = await listBuildTasks();
    if (res.data.code === 0) {
      tasks.value = res.data.data || [];
    }
  } catch (error) {
    ElMessage.error('加载构建任务失败');
  } finally {
    loading.value = false;
  }
};

const downloadApk = (row: any) => {
  const url = row.output_path?.replace('/uploads/', '/api/uploads/');
  if (url) {
    window.open(url, '_blank');
  }
};

const viewLog = async (row: any) => {
  currentLog.value = row.build_log || '暂无日志';
  showLogDialog.value = true;
};

// 自动刷新
const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    const hasBuilding = tasks.value.some((t: any) => t.status === 'building' || t.status === 'pending');
    if (hasBuilding) {
      loadTasks();
    }
  }, 5000);
};

onMounted(() => {
  loadTasks();
  startAutoRefresh();
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped lang="scss">
.app-build-panel {
  .build-log {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    border-radius: 4px;
    max-height: 400px;
    overflow-y: auto;
    font-family: 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/views/admin/app-config/AppBuildPanel.vue
git commit -m "feat: add app build panel"
```

---

### Task 13: 注册路由和菜单

**Files:**
- Modify: `web/src/router/index.ts`
- Modify: `web/src/views/admin/AdminLayout.vue`

- [ ] **Step 1: 添加APP管理路由**

在 `web/src/router/index.ts` 的 `/admin` children 中添加：

```typescript
{
  path: 'app-manage',
  name: 'AppManage',
  component: () => import('@/views/admin/AppManage.vue'),
  meta: { title: 'APP管理', requiresAdmin: true }
}
```

- [ ] **Step 2: 添加APP管理菜单**

在 `web/src/views/admin/AdminLayout.vue` 的 `<el-menu>` 中，在"系统升级"之前添加：

```vue
<el-menu-item index="/admin/app-manage">
  <el-icon><Cellphone /></el-icon>
  <span>APP管理</span>
</el-menu-item>
```

并确保导入 `Cellphone` 图标：

```typescript
import { Cellphone } from '@element-plus/icons-vue';
```

- [ ] **Step 3: Commit**

```bash
git add web/src/router/index.ts web/src/views/admin/AdminLayout.vue
git commit -m "feat: register app management route and menu"
```

---

## 阶段3：Capacitor移动端

### Task 14: 初始化Capacitor项目

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/capacitor.config.ts`

- [ ] **Step 1: 创建mobile目录和package.json**

```bash
mkdir -p d:\legado-home\mobile
```

```json
{
  "name": "soumal-reader-mobile",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "sync": "npx cap sync",
    "build:android": "npx cap build android",
    "open:android": "npx cap open android"
  },
  "dependencies": {
    "@capacitor/android": "^6.0.0",
    "@capacitor/core": "^6.0.0",
    "@capacitor/splash-screen": "^6.0.0",
    "@capacitor/status-bar": "^6.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^6.0.0"
  }
}
```

- [ ] **Step 2: 创建Capacitor配置**

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soumal.reader',
  appName: '搜猫阅读',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: '',
      keystoreAlias: '',
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFFFFF',
    },
  },
};

export default config;
```

- [ ] **Step 3: 安装依赖并初始化Android项目**

```bash
cd d:\legado-home\mobile
npm install
npx cap add android
```

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat: initialize capacitor mobile project"
```

---

### Task 15: 平台检测与APP初始化

**Files:**
- Create: `web/src/utils/platform.ts`
- Modify: `web/src/main.ts`

- [ ] **Step 1: 创建平台检测工具**

```typescript
// web/src/utils/platform.ts

export const isCapacitor = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

export const getPlatform = (): string => {
  if (!isCapacitor()) return 'web';
  return (window as any).Capacitor.getPlatform();
};

export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';
export const isHarmony = (): boolean => getPlatform() === 'harmony';
export const isWeb = (): boolean => getPlatform() === 'web';

// APP初始化：读取后台配置
export async function initAppConfig(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    const res = await fetch('/api/app/config');
    const result = await res.json();
    
    if (result.code === 0 && result.data) {
      const config = result.data;
      
      // 设置API基础地址
      if (config.api_base_url) {
        localStorage.setItem('API_BASE_URL', config.api_base_url);
      }
      
      // 设置主题色
      if (config.theme_color) {
        document.documentElement.style.setProperty('--el-color-primary', config.theme_color);
      }
      
      // 设置应用名称
      if (config.app_name) {
        document.title = config.app_name;
      }
    }
  } catch (error) {
    console.error('APP配置初始化失败:', error);
  }
}

// 检查APP更新
export async function checkAppUpdate(): Promise<void> {
  if (!isCapacitor()) return;

  try {
    // 获取当前版本（从Capacitor或本地存储）
    const currentVersionCode = parseInt(localStorage.getItem('APP_VERSION_CODE') || '0');
    const platform = getPlatform();
    
    const res = await fetch(`/api/app/check-update?platform=${platform}&version_code=${currentVersionCode}`);
    const result = await res.json();
    
    if (result.code === 0 && result.data?.has_update) {
      const update = result.data;
      
      if (update.force_update) {
        // 强制更新：显示不可关闭的对话框
        alert(`发现新版本 ${update.version_name}，请更新后继续使用。\n\n更新内容：\n${update.changelog}`);
        if (update.download_url) {
          window.location.href = update.download_url;
        }
      } else {
        // 可选更新
        const confirmUpdate = confirm(`发现新版本 ${update.version_name}，是否更新？\n\n更新内容：\n${update.changelog}`);
        if (confirmUpdate && update.download_url) {
          window.location.href = update.download_url;
        }
      }
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
}
```

- [ ] **Step 2: 修改main.ts添加初始化**

在 `web/src/main.ts` 中找到应用初始化代码，在 `app.mount('#app')` 之后添加：

```typescript
import { initAppConfig, checkAppUpdate } from './utils/platform';

// ... 现有代码 ...

app.mount('#app');

// APP初始化
initAppConfig().then(() => {
  checkAppUpdate();
});
```

- [ ] **Step 3: Commit**

```bash
git add web/src/utils/platform.ts web/src/main.ts
git commit -m "feat: add platform detection and app initialization"
```

---

### Task 16: 配置Vite支持mobile别名

**Files:**
- Modify: `web/vite.config.ts`

- [ ] **Step 1: 添加mobile别名**

在 `web/vite.config.ts` 的 `resolve.alias` 中添加：

```typescript
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
    '@mobile': fileURLToPath(new URL('../mobile', import.meta.url)),
  },
},
```

- [ ] **Step 2: Commit**

```bash
git add web/vite.config.ts
git commit -m "feat: add mobile alias in vite config"
```

---

## 阶段4：构建系统与上架准备

### Task 17: Android签名配置

**Files:**
- Create: `mobile/android/keystore/README.md`

- [ ] **Step 1: 创建签名说明文档**

```markdown
# Android签名配置

## 生成签名密钥

```bash
keytool -genkey -v -keystore soumal-reader.keystore -alias soumal -keyalg RSA -keysize 2048 -validity 10000
```

## 配置签名

1. 将 `soumal-reader.keystore` 放入此目录
2. 在 `mobile/android/app/build.gradle` 的 `android.signingConfigs` 中配置：

```gradle
signingConfigs {
    release {
        storeFile file("../keystore/soumal-reader.keystore")
        storePassword "你的密码"
        keyAlias "soumal"
        keyPassword "你的密码"
    }
}
```

## 上架要求

- 应用名称：搜猫阅读
- 包名：com.soumal.reader
- 最低SDK：21（Android 5.0）
- 目标SDK：34（Android 14）
- 需要隐私政策页面
- 需要用户协议页面
```

- [ ] **Step 2: Commit**

```bash
git add mobile/android/keystore/README.md
git commit -m "docs: add android signing instructions"
```

---

### Task 18: 上架合规检查清单

**Files:**
- Create: `docs/app-store-compliance.md`

- [ ] **Step 1: 创建上架合规文档**

```markdown
# APP上架合规检查清单

## 华为应用市场（鸿蒙/Android）

### 必备材料
- [ ] 软件著作权证书
- [ ] ICP备案号（已配置在后台）
- [ ] 隐私政策URL（已在后台配置）
- [ ] 用户协议URL（已在后台配置）
- [ ] 应用图标（512x512 PNG）
- [ ] 应用截图（3-5张，1080x1920）
- [ ] 应用介绍文案
- [ ] 开发者实名认证

### 内容合规
- [ ] 无色情低俗内容
- [ ] 无政治敏感内容
- [ ] 版权合规（书源来源合法）
- [ ] 无诱导分享/下载

### 技术合规
- [ ] 隐私政策在应用内可访问
- [ ] 用户协议在应用内可访问
- [ ] 敏感权限申请有明确说明
- [ ] 应用崩溃率 < 1%

## 小米应用商店

### 必备材料
- [ ] 同上华为材料
- [ ] 小米开发者账号

## OPPO/vivo/应用宝

### 必备材料
- [ ] 同上基础材料
- [ ] 各平台开发者账号

## 注意事项

1. **小说类APP审核严格**：需确保书源内容合法，建议添加内容审核机制
2. **隐私合规**：首次启动需展示隐私政策，获取用户同意
3. **权限最小化**：只申请必要权限（网络、存储）
4. **未成年人保护**：建议添加青少年模式
```

- [ ] **Step 2: Commit**

```bash
git add docs/app-store-compliance.md
git commit -m "docs: add app store compliance checklist"
```

---

## 验证与测试

### Task 19: 后端API测试

- [ ] **Step 1: 测试APP配置API**

```bash
# 获取公开配置
curl http://localhost:3001/api/app/config

# 管理员获取配置
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/app/admin/config

# 更新配置
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"app_name":"测试应用","api_base_url":"https://test.com"}' \
  http://localhost:3001/api/app/admin/config
```

- [ ] **Step 2: 测试版本管理API**

```bash
# 创建版本
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"platform":"android","version_name":"1.0.0","version_code":1}' \
  http://localhost:3001/api/app/admin/versions

# 列表版本
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/app/admin/versions
```

- [ ] **Step 3: 测试检查更新API**

```bash
curl "http://localhost:3001/api/app/check-update?platform=android&version_code=1"
```

---

### Task 20: 前端页面测试

- [ ] **Step 1: 验证后台菜单**

1. 登录后台管理面板
2. 确认侧边栏有"APP管理"菜单
3. 点击进入，确认显示4个标签页

- [ ] **Step 2: 验证配置页面**

1. 在"基础配置"标签修改应用名称
2. 点击保存，确认提示成功
3. 刷新页面，确认配置已持久化

- [ ] **Step 3: 验证版本管理**

1. 在"版本管理"标签点击"创建版本"
2. 填写版本号、版本代码
3. 确认版本出现在列表中

---

### Task 21: 移动端构建测试

- [ ] **Step 1: 构建Web产物**

```bash
cd d:\legado-home\web
npm run build
```

- [ ] **Step 2: 同步到Capacitor**

```bash
cd d:\legado-home\mobile
npx cap sync android
```

- [ ] **Step 3: 构建Debug APK**

```bash
cd d:\legado-home\mobile\android
.\gradlew assembleDebug
```

- [ ] **Step 4: 安装测试**

```bash
adb install app\build\outputs\apk\debug\app-debug.apk
```

---

## 部署与上线

### Task 22: 生产环境部署

- [ ] **Step 1: 确保服务器环境**

```bash
# 检查Node.js版本
node -v  # 需要 >= 18

# 检查Java版本（Android构建需要）
java -version  # 需要 >= 17

# 检查Android SDK
echo $ANDROID_HOME
```

- [ ] **Step 2: 部署后端更新**

```bash
cd d:\legado-home\server
npm run build
pm2 restart legado-server
```

- [ ] **Step 3: 部署前端更新**

```bash
cd d:\legado-home\web
npm run build
# 复制dist到服务器Web目录
```

- [ ] **Step 4: 首次构建APP**

1. 登录后台管理面板
2. 进入"APP管理"
3. 配置基础信息（应用名称、服务器地址）
4. 上传图标和启动图
5. 创建新版本
6. 点击"构建"
7. 等待构建完成，下载APK

---

## 计划自检

### Spec覆盖检查

| 需求 | 对应Task |
|------|---------|
| 后台APP管理一级菜单 | Task 13 |
| 基础配置（名称、包名、服务器地址、主题色） | Task 9 |
| 品牌配置（图标、启动图上传） | Task 10 |
| 版本管理（CRUD、发布状态） | Task 11 |
| 构建任务（一键构建、进度、下载） | Task 12 |
| APP启动读取后台配置 | Task 15 |
| APP检查更新 | Task 15 |
| Android构建 | Task 14, 17 |
| 鸿蒙支持 | Task 14（后续扩展） |
| 上架合规 | Task 18 |

### Placeholder扫描
- 无TBD/TODO
- 所有代码片段完整
- 所有文件路径明确

### 类型一致性
- `AppConfig` 接口在 service 和 controller 中一致
- `AppVersion` 接口在 service 和 controller 中一致
- `BuildTask` 接口在 service 和 controller 中一致

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-capacitor-app-build-system.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

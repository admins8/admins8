# 一键升级使用手册

本项目支持后台「系统升级」页一键升级。升级包通过 GitHub Pages 公开仓库分发，使用 RSA-SHA256 签名校验，部署侧已带备份+自动回滚+PM2 零停机重载。

仓库地址：https://github.com/admins88/legado-home
GitHub Pages 地址（manifest）：https://admins88.github.io/legado-home/manifest.json

---

## 一、整体架构

```
┌─────────────────┐  发布     ┌─────────────────────────────────┐
│ 你的开发机      │ ───────▶ │ admins88/legado-home (Pages)    │
│ pack-update.cjs │           │   manifest.json                 │
│ + 私钥签名      │           │   releases/<version>/update.zip │
└─────────────────┘           │   releases/<version>/update.zip.sig
                              └─────────────────────────────────┘
                                          │
                                          │  HTTPS（GitHub CDN）
                                          ▼
                              ┌─────────────────────────────────┐
                              │ 客户服务器（Bao Ta + PM2）       │
                              │  后台 → 系统升级                  │
                              │  1) /api/admin/update/check      │
                              │  2) /api/admin/update/download   │
                              │     RSA-SHA256 公钥校验          │
                              │  3) /api/admin/update/install    │
                              │     备份 → 原子替换 → PM2 reload │
                              │     失败自动回滚                  │
                              └─────────────────────────────────┘
```

公钥与私钥分离保存：

- 私钥 `.secrets/license/private.pem` —— 仅在你本地保存，不入库不外发
- 公钥 `license-tools/keys/public.pem` —— 已被打入交付包 `server/license/public.pem`

也可以通过环境变量指定私钥：

```powershell
$env:LICENSE_PRIVATE_KEY_PATH='D:\secure\license-private.pem'
```

---

## 二、GitHub Pages 仓库一次性初始化

仅需做一次。

1. 仓库设置 → Pages → Source 选择 `Deploy from a branch`，分支 `main` / `master`，目录 `/ (root)`。
2. 在仓库根目录建立空骨架（首次推送）：

```
legado-home/
├── manifest.json           # 见下方示例
├── README.md               # （可选）公开页面说明
└── releases/               # 由 pack-update.cjs 自动写入
```

3. `manifest.json` 初始示例（可空 releases，但字段必须存在）：

```json
{
  "latest": "1.0.0",
  "releases": []
}
```

4. 推送后访问 `https://admins88.github.io/legado-home/manifest.json` 应能返回 JSON。

---

## 三、发版流程（每次发布）

> 前置：在你本地的 `D:\legado-home`（开发仓库）。
> 假设 GitHub Pages 仓库已 clone 到 `D:\legado-pages`。

1. **修改源码 → 提交 git**

2. **执行打包**（同时构建 server/web、混淆、打 zip、签名、写 manifest）：

```powershell
cd D:\legado-home
node license-tools\pack-update.cjs `
  --version 1.1.0 `
  --changelog "1) 修复阅读页字号；2) 新增系统升级页" `
  --pages D:\legado-pages `
  --baseUrl https://admins88.github.io/legado-home
```

可选参数：
- `--minVersion 1.0.0`：低于此版本的旧客户必须先升到中间版本，避免破坏性变更
- `--key D:\path\private.pem`：使用其它私钥
- `--out release\update`：自定义输出目录
- `--skipBuild`：跳过 build:protected（仅重新打包/签名时用）

执行后，会在 `D:\legado-pages` 下生成：

```
manifest.json                    （已更新 latest 与 releases）
releases/1.1.0/update.zip
releases/1.1.0/update.zip.sig
```

3. **推送到 GitHub Pages 仓库**

```powershell
cd D:\legado-pages
git add manifest.json releases/1.1.0
git commit -m "release 1.1.0"
git push
```

GitHub Pages 一般 1~3 分钟生效。

4. **客户后台 → 系统升级**
   - 进入「管理后台 → 系统升级」（仅超级管理员可见）
   - 点击「检查更新」→ 显示新版本与变更日志
   - 点击「下载升级包」→ 后端下载 zip 与 sig，RSA 校验通过后解压到临时目录
   - 点击「应用升级」→ 备份当前 dist，原子替换 server/dist 与 web/dist，PM2 reload，失败自动回滚

也可由超级管理员登录后被动接收：进入后台时若发现新版本，会自动弹出 ElNotification 提醒。

---

## 四、升级包内部结构

`update.zip` 解压后必须满足如下布局，否则后端会拒绝安装：

```
update.zip
├── version.txt              # 必须存在，与 manifest 的 version 一致
├── server/
│   └── dist/...             # 服务端混淆后的 JS（替换 <serverRoot>/dist）
└── web/
    └── dist/...             # 前端混淆后的静态资源（替换 <webRoot>/dist）
```

> `pack-update.cjs` 会自动按此结构生成。

---

## 五、客户端环境变量（可选）

在客户的 `server/.env` 中可以覆盖以下默认值：

```
# 升级清单地址（默认即指向你的仓库）
UPDATE_MANIFEST_URL=https://admins88.github.io/legado-home/manifest.json

# 是否启用在线检查（默认 true，false 表示仅手动上传）
UPDATE_ONLINE=true

# 升级临时下载目录、备份目录、历史文件
UPDATE_WORK_DIR=data/updates
UPDATE_BACKUP_DIR=data/backups
UPDATE_HISTORY_FILE=data/update-history.json

# PM2 进程名（默认 legado-server，与启动脚本一致）
UPDATE_PM2_NAME=legado-server

# 公钥路径（默认复用 license/public.pem，无需修改）
LICENSE_PUBLIC_KEY_PATH=license/public.pem
```

---

## 六、手动上传 zip（在线下载受限时）

当客户服务器无法访问 GitHub Pages（CDN 被墙等）时：

1. 你本地仍按上面流程生成 `release/update/update.zip` 与 `update.zip.sig`
2. 把这两个文件用任意方式（FTP / 宝塔文件管理 / 微信传文件）发给客户
3. 客户在「系统升级 → 手动上传升级包」分别上传 zip 与 sig，然后「应用升级」

签名校验、备份、回滚流程完全一致，安全级别一样。

---

## 七、失败处理与回滚

- **校验失败**：返回「升级包签名校验失败」，dist 不会被替换
- **替换失败 / PM2 reload 失败**：自动回滚到原 dist，再次 PM2 reload
- **手动回滚**：进入「升级历史」表格，找到任意一条带备份目录的记录，点「回滚」即可还原到那次升级前的状态

历史记录最多保留最近 50 条，存储于 `<serverRoot>/../data/update-history.json`。

备份目录布局：

```
data/backups/
└── <fromVersion>-<timestamp>/
    ├── server-dist/        # 升级前的 server/dist 完整副本
    ├── web-dist/
    └── meta.json
```

---

## 八、私钥管理（重要）

- 私钥仅存放在 `.secrets/license/private.pem` 或 `LICENSE_PRIVATE_KEY_PATH` 指向的位置，**不要提交到任何仓库**（项目根 `.gitignore` 已默认忽略 `.secrets/`）
- 升级签名与 license 签名共用同一对密钥；如需轮换：
  1. 用 `generate-keys.cjs` 重新生成
  2. 把新公钥替换到所有客户的 `server/license/public.pem`（这一步本身需要先用旧密钥发一次升级，把新公钥打进 dist；或者通过客服远程替换）
  3. 之后的 license/升级都用新私钥签

---

## 九、常用命令速查

| 操作 | 命令 |
|------|------|
| 单独签一个文件 | `node license-tools/sign-file.cjs --file path/to/x.zip` |
| 打 + 推升级 | `node license-tools/pack-update.cjs --version 1.x.y --pages D:\legado-pages` |
| 不重新构建仅打包 | 加 `--skipBuild` |
| 查看本地版本 | `cat D:\legado-home\VERSION` |
| 查看客户当前版本 | 后台「系统升级」页或 `GET /api/health` |

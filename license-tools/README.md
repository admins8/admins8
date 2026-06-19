# 授权与交付指南（开发者使用）

> 本文档供你（开发者/供应商）日常使用，不要随交付包发给客户。客户拿到的是 `release/<customer>/README.md`。

## 一、首次准备：生成 RSA 密钥对

只需做一次。私钥永远留在你本地，公钥跟随每个交付包。

```powershell
node license-tools/generate-keys.cjs .secrets/license
```

生成两份文件：
- `.secrets/license/private.pem` —— 留底，绝不外传
- `.secrets/license/public.pem` —— 复制到 `license-tools/keys/public.pem` 后随 `pack-release` 嵌入到交付包

> `.secrets/` 已加入 `.gitignore`。私钥不应放在可交付目录或公开仓库中。

## 私钥和交付边界

- `.secrets/` 和 `private.pem` 只允许存在于供应商签发环境。
- 客户交付包、更新包、Docker 镜像和 `release/` 目录不得包含私钥。
- 客户环境只需要 `license.lic` 和 `public.pem`。
- 如果打包脚本发现 `.secrets` 或 `private.pem`，会拒绝继续生成交付产物。

## 私钥管理

私钥默认读取：

```text
.secrets/license/private.pem
```

也可以通过环境变量指定：

```powershell
$env:LICENSE_PRIVATE_KEY_PATH='D:\secure\license-private.pem'
```

## 二、给某个客户签发 license.lic

```powershell
node license-tools/generate-license.cjs `
  --licenseId LIC-2026-0001 `
  --customerId customer-soumal `
  --customerName "搜麦阅读" `
  --domains "soumal.com,*.soumal.com" `
  --note "首批授权" `
  --out license-tools/out/customer-soumal/license.lic
```

要点：
- `--licenseId` 全局唯一，便于事后追踪每一份授权（即使被泄露也能定位是哪个客户）。
- `--customerId` / `--customerName` 写入 payload，客户 IP 异常时可作为追溯线索。
- `--domains` 支持精确域名与一级通配，例如 `soumal.com,*.soumal.com` 同时覆盖 `soumal.com`、`m.soumal.com`、`book.soumal.com`。
- 不带过期字段，一次签发永久有效；如需吊销请见后文。

## 三、构建并打包交付物

```powershell
node license-tools/pack-release.cjs --customer customer-soumal
```

脚本会执行：
1. `server/`：`tsc` 编译 + `javascript-obfuscator` 强混淆，并删除所有 `.d.ts`、`.js.map` 与 `.test.js`。
2. `web/`：`vite build` + 浏览器端混淆，删除 sourceMap。
3. 拷贝混淆后的产物到 `release/<customer>/{server,web}/`。
4. 在 `release/<customer>/server/license/` 放入 `public.pem`。
5. 自动 `npm install --omit=dev` 装好后端生产依赖。
6. 拷贝 `docker/` 目录与 `start.bat` / `start.sh` 便利启动脚本，生成 `README.md`。

最终目录结构如下（**完全不包含 src**）：

```
release/customer-soumal/
  server/
    dist/             ← 混淆后的 JS
    node_modules/
    package.json
    .env.example
    license/
      public.pem      ← 公钥
      PLACE_LICENSE_HERE.txt
  web/dist/           ← 混淆后的前端静态资源
  docker/
  start.bat / start.sh
  README.md
```

## 四、把 license 与交付包一起发给客户

```powershell
Copy-Item license-tools/out/customer-soumal/license.lic release/customer-soumal/server/license/license.lic
```

然后把 `release/customer-soumal/` 整个打包发给客户：

```powershell
Compress-Archive -Path release/customer-soumal/* -DestinationPath dist/customer-soumal.zip
```

## 五、客户的部署方式

客户拿到 zip 后两种部署方式：

### 方式 A：直接 Node 启动（适合熟悉 Node 的客户）
1. 安装 MySQL 8.x / Redis（可选）
2. 复制 `server/.env.example` 为 `server/.env`，按实际环境改
3. 双击 `start.bat`（Windows）或运行 `bash start.sh`（Linux）

### 方式 B：Docker Compose（推荐）
1. 在 `release/customer-soumal/` 内创建 `.env`，填入 `DB_PASSWORD` / `JWT_SECRET` 等
2. 进入 `docker/` 目录执行 `docker compose up -d`
3. 服务启动时会自动从 `../server/license/` 读取 `license.lic` 与 `public.pem`

## 六、常见问题

**Q：客户能不能改源码绕过授权？**
A：交付包没有源码，只有混淆后的 JS。要破解需要：① 反混淆 → ② 看懂 RSA 验签流程 → ③ 自己用合法的私钥重签。私钥不在交付包里，因此最后一步走不通。

**Q：客户能不能直接删 license 检查代码？**
A：理论上可以，但前提是反混淆并理解整套验证逻辑（`licenseService.js` + `app.js` 启动流程 + `licenseGuard.js`）。一旦改动，他将永远无法接受你后续的版本更新——这就是商业上的成本。

**Q：客户多个域名都想用怎么办？**
A：在签发时用通配，例如 `--domains "soumal.com,*.soumal.com"`。需要新增独立域名时重新签发并替换 `license.lic` 即可。

**Q：怎么吊销已签发的授权？**
A：本方案不带在线校验，签发后只能靠下次升级时强制要求新版 license（例如改 public.pem 并要求换新 license）。如未来需要在线吊销，可在 `licenseService` 增加心跳上报到自有服务。

## 七、密钥保管建议

- `private.pem` 立即备份至离线 U 盘 / 密码管理器；
- 如怀疑私钥泄露：重新生成一对密钥 → 重新签发所有客户的 license → 推送新版交付包，客户更新后旧的 `license.lic` 全部失效。

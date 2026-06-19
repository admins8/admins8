# Legado Web - 阅读3.0 网站版

基于 Legado 阅读3.0 改造的 Web 版本，支持在线阅读、书源管理、用户系统和管理后台。

## 快速开始

### 方式一：Docker 部署（推荐）

```bash
# 一键启动
docker-compose up -d

# 访问 http://localhost:3000
# 默认管理员：admin / admin123
```

### 方式二：本地开发

```bash
# 1. 启动后端
cd server
npm install
cp .env.example .env
npm run dev

# 2. 启动前端（新终端）
cd web
npm install
npm run dev

# 前端: http://localhost:5173
# 后端: http://localhost:3000
```

## 功能

- 🔐 用户系统：注册、登录、个人中心
- 📚 书架管理：添加/移除书籍、搜索
- 📖 在线阅读：章节浏览、进度保存、字体调节
- 🔍 书源管理：导入/编辑/启用/禁用书源
- 👨‍💼 管理后台：用户管理、数据统计、书籍管理

## 技术栈

- **前端**: Vue 3 + Vite + Element Plus + Pinia + TypeScript
- **后端**: Node.js + Express + TypeScript
- **数据库**: SQLite（可切换 PostgreSQL）
- **部署**: Docker

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

## 目录结构

```
├── server/           # 后端服务
│   ├── src/
│   │   ├── config/      # 配置（数据库、JWT）
│   │   ├── controllers/ # 控制器
│   │   ├── middleware/   # 中间件（认证、错误处理）
│   │   ├── models/       # 数据模型
│   │   ├── routes/       # 路由
│   │   ├── services/     # 业务逻辑（书源解析引擎）
│   │   └── app.ts        # 入口
│   └── package.json
├── web/              # 前端
│   ├── src/
│   │   ├── api/         # API 封装
│   │   ├── router/      # 路由
│   │   ├── store/       # 状态管理
│   │   ├── views/       # 页面
│   │   └── styles/      # 全局样式
│   └── package.json
├── docker-compose.yml
└── Dockerfile
```

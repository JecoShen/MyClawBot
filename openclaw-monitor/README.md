# OpenClaw 监控面板

监控你的 OpenClaw 实例状态、查看日志、管理更新。

## 功能

- ✅ **实时状态监控** - Gateway 运行状态、系统资源（CPU/内存/磁盘）
- ✅ **版本管理** - 查看当前版本、检查更新、查看更新日志
- ✅ **日志查看** - 查看最近 100 行 Gateway 日志，一键复制给 AI 诊断
- ✅ **远程控制** - 重启 Gateway、更新 OpenClaw
- ✅ **多实例支持** - 可添加多个远程 OpenClaw 实例进行监控

## 技术栈

- **前端**: React + Vite + TailwindCSS
- **后端**: Node.js + Express + TypeScript
- **通信**: WebSocket (OpenClaw Gateway)

## 端口

- 前端开发：3000
- 后端 API: 3001
- 静态文件服务：后端直接服务前端构建产物（3001 端口）

## 运行

### 开发模式

```bash
# 后端（终端 1）
cd backend
npm run dev

# 前端（终端 2）
cd frontend
npm run dev
```

### 生产模式

```bash
# 构建前端
cd frontend
npm run build

# 运行后端（服务前端静态文件）
cd backend
npm run build
npm run start
```

## 公网访问

在 GitHub Codespaces 上运行时，访问：

```
https://{codespace-name}-{random}.app.github.dev
```

将默认端口（18789）替换为 3001 即可访问监控面板。

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/status/local` | GET | 获取本地实例状态 |
| `/api/version/latest` | GET | 获取最新版本信息 |
| `/api/logs` | GET | 获取 Gateway 日志 |
| `/api/sessions` | GET | 获取会话列表 |
| `/api/gateway/restart` | POST | 重启 Gateway |
| `/api/update` | POST | 更新 OpenClaw |
| `/api/instances` | GET/POST | 获取/添加远程实例 |
| `/api/instances/:id` | DELETE | 删除远程实例 |
| `/api/instances/:id/status` | GET | 检查远程实例状态 |

## 添加远程实例

通过 API 添加其他 OpenClaw 实例进行监控：

```bash
curl -X POST http://localhost:3001/api/instances \
  -H "Content-Type: application/json" \
  -d '{
    "id": "home-server",
    "name": "家里服务器",
    "url": "ws://192.168.1.100:18789",
    "token": "your-gateway-token"
  }'
```

## 部署到 VPS

1. 克隆项目到 VPS
2. 安装依赖：`npm install`（前后端分别执行）
3. 构建前端：`cd frontend && npm run build`
4. 构建后端：`cd backend && npm run build`
5. 运行后端：`cd backend && npm run start`
6. 使用 Nginx/Caddy 反向代理 3001 端口到你的域名

## 注意事项

- 确保防火墙开放 3001 端口
- 生产环境建议配置 HTTPS
- 远程实例需要开放 Gateway WebSocket 端口（默认 18789）
- 建议使用 Token 认证保护 API

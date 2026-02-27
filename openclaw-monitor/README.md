# OpenClaw 监控面板 🦞

一个现代化的 OpenClaw 多实例监控面板，让你随时随地监控所有 OpenClaw 实例的运行状态。

## ✨ 功能特性

### 实时监控
- 🟢 **Gateway 状态** - 实时显示 OpenClaw Gateway 运行状态（在线/离线/错误）
- 💻 **系统资源** - CPU 核心数、内存使用率、磁盘空间占用
- ⏱️ **运行时间** - 显示系统运行时长
- 🔄 **自动刷新** - 每 30 秒自动更新数据

### 版本管理
- 📦 **当前版本** - 显示已安装的 OpenClaw 版本
- 🆕 **最新版本** - 自动检查 GitHub 最新版本
- 📝 **更新日志** - 显示版本更新内容（自动翻译中文）
- ⬆️ **一键更新** - 支持远程更新 OpenClaw

### 日志查看
- 📋 **最近日志** - 查看 Gateway 最近 100 行日志
- 📋 **一键复制** - 快速复制日志给 AI 诊断问题

### 远程控制
- 🔄 **重启 Gateway** - 远程重启 OpenClaw Gateway
- 🔧 **多实例支持** - 可添加多个远程 OpenClaw 实例

### 界面设计
- 🎨 **现代 UI** - 基于 TailwindCSS 的深色主题
- 📱 **响应式** - 适配桌面和移动设备
- 🇨🇳 **中文界面** - 完全中文化

---

## 🚀 快速开始

### 本地开发

```bash
# 1. 克隆项目
cd openclaw-monitor

# 2. 安装后端依赖
cd backend
npm install

# 3. 安装前端依赖
cd ../frontend
npm install

# 4. 构建前端
npm run build

# 5. 构建后端
cd ../backend
npm run build

# 6. 启动后端服务（同时服务前端静态文件）
npm run start
```

访问：http://localhost:3001

### 生产部署（VPS）

#### 前置要求
- Node.js >= 22
- npm 或 pnpm
- 反向代理（Nginx/Caddy，可选）

#### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/JecoShen/MyClawBot.git
cd MyClawBot/openclaw-monitor

# 2. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 3. 构建
cd ../frontend && npm run build
cd ../backend && npm run build

# 4. 启动服务
cd ../backend
npm run start
```

#### 使用 PM2 守护进程（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start backend/dist/index.js --name openclaw-monitor

# 设置开机自启
pm2 startup
pm2 save
```

#### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name monitor.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### HTTPS 配置（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d monitor.yourdomain.com
```

---

## 📡 API 端点

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

---

## 🔧 配置

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | 3001 | 后端服务端口 |
| `OPENCLAW_GATEWAY_TOKEN` | '' | Gateway 认证 Token |

### 添加远程实例

通过 API 添加其他 OpenClaw 实例：

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

---

## 📦 技术栈

### 前端
- **React 18** - UI 框架
- **Vite 5** - 构建工具
- **TailwindCSS 3** - CSS 框架
- **TypeScript 5** - 类型系统

### 后端
- **Node.js 22+** - 运行环境
- **Express 4** - Web 框架
- **TypeScript 5** - 类型系统
- **WebSocket** - Gateway 通信

---

## 📝 版本更新日志

### v1.0.0 (2026-02-27)

**🎉 首次发布**

**新功能**
- ✅ 实时状态监控（Gateway 运行状态、系统资源）
- ✅ 版本管理（当前版本、最新版本、更新日志）
- ✅ 日志查看（最近 100 行，一键复制）
- ✅ 远程控制（重启 Gateway、更新 OpenClaw）
- ✅ 多实例支持
- ✅ 更新日志自动翻译中文

**技术特性**
- ✅ 每 30 秒自动刷新
- ✅ 响应式设计
- ✅ 深色主题 UI
- ✅ TypeScript 全栈类型安全

---

## ⚠️ 注意事项

1. **端口占用** - 默认使用 3001 端口，如有冲突请修改 `PORT` 环境变量
2. **防火墙** - 确保 VPS 防火墙开放相应端口
3. **HTTPS** - 生产环境强烈建议使用 HTTPS
4. **认证** - 远程实例需要配置 Gateway Token 进行认证
5. **权限** - 确保运行用户有权限执行 `openclaw` 命令

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

项目地址：https://github.com/JecoShen/MyClawBot

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [OpenClaw](https://github.com/openclaw/openclaw) - 强大的自托管 AI 网关
- [TailwindCSS](https://tailwindcss.com/) - 实用的 CSS 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具

---

**🦞 让 OpenClaw 监控变得简单！**

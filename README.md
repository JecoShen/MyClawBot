# OpenClaw 监控面板 🦞

**一个独立的 OpenClaw 多实例监控面板，部署在 VPS 上，即使所有 OpenClaw 实例都挂了，监控面板依然在线。**

[![GitHub Release](https://img.shields.io/github/v/release/JecoShen/MyClawBot?label=版本)](https://github.com/JecoShen/MyClawBot/releases)
[![License](https://img.shields.io/github/license/JecoShen/MyClawBot)](LICENSE)

---

## ✨ 核心功能

### 🖥️ 多实例监控
- **本地实例** - 监控当前服务器上的 OpenClaw Gateway
- **远程实例** - 添加任意数量的远程 OpenClaw 实例（家庭服务器、公司服务器、VPS 等）
- **实时状态** - 在线/离线/错误状态一目了然
- **自动刷新** - 每 30 秒自动检查所有实例状态

### 📊 系统资源监控
- **CPU** - 核心数 + 实时使用率
- **内存** - 使用量 + 百分比 + 进度条
- **磁盘** - 已用/总计 + 百分比
- **运行时间** - 系统 uptime

### 📝 日志与诊断
- **最近日志** - 查看 Gateway 最近 100 行日志
- **一键复制** - 快速复制日志给 AI 诊断问题
- **错误检测** - 自动检测连接错误并显示

### 🔄 版本管理
- **当前版本** - 显示已安装的 OpenClaw 版本
- **最新版本** - 自动检查 GitHub 最新版本
- **更新日志** - 显示版本更新内容（自动翻译中文）
- **一键更新** - 支持远程更新 OpenClaw

### 🔗 官方资源
- GitHub 仓库
- Releases 页面
- 官方文档
- Discord 社区
- ClawHub 技能市场

### 🎨 现代化 UI
- **深色主题** - 护眼设计，适合 24 小时监控
- **毛玻璃效果** - 现代感十足的视觉体验
- **响应式设计** - 完美适配桌面和移动设备
- **中文界面** - 完全中文化

---

## 🚀 快速开始

### 方式一：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/JecoShen/MyClawBot.git
cd MyClawBot/openclaw-monitor

# 2. 安装后端依赖
cd backend
npm install

# 3. 安装前端依赖
cd ../frontend
npm install

# 4. 启动后端服务（同时服务前端静态文件）
cd ../backend
npm run dev
```

访问：**http://localhost:3001**

### 方式二：生产部署（VPS）

#### 前置要求
- Node.js >= 22
- npm 或 pnpm
- Linux 服务器（推荐 Ubuntu 22.04+）

#### 一键部署脚本

```bash
# 1. 克隆项目
git clone https://github.com/JecoShen/MyClawBot.git
cd MyClawBot/openclaw-monitor

# 2. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 3. 构建前端
cd ../frontend && npm run build

# 4. 构建后端
cd ../backend && npm run build

# 5. 启动服务
cd ../backend
npm run start
```

访问：**http://你的服务器 IP:3001**

#### 使用 PM2 守护进程（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd /path/to/MyClawBot/openclaw-monitor/backend
pm2 start dist/index.js --name openclaw-monitor

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs openclaw-monitor
```

#### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name monitor.yourdomain.com;

    # 强制 HTTPS（可选）
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### HTTPS 配置（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d monitor.yourdomain.com

# 自动续期（已自动配置 cron）
sudo certbot renew --dry-run
```

---

## 📡 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/status/all` | GET | 获取所有实例状态（本地 + 远程） |
| `/api/instances` | GET | 获取远程实例列表 |
| `/api/instances` | POST | 添加远程实例 |
| `/api/instances/:id` | DELETE | 删除远程实例 |
| `/api/instances/:id/status` | GET | 刷新单个实例状态 |
| `/api/version/latest` | GET | 获取最新版本信息 |
| `/api/logs` | GET | 获取 Gateway 日志 |
| `/api/gateway/restart` | POST | 重启 Gateway |
| `/api/update` | POST | 更新 OpenClaw |
| `/api/links` | GET | 获取官方链接 |

---

## 🔧 配置

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | 3001 | 后端服务端口 |
| `OPENCLAW_LOCAL_URL` | `ws://127.0.0.1:18789` | 本地 Gateway WebSocket 地址 |
| `OPENCLAW_GATEWAY_TOKEN` | `''` | Gateway 认证 Token |
| `GITHUB_TOKEN` | `''` | GitHub API Token（避免限流） |
| `INSTANCE_NAME` | `GitHub Codespaces` | 当前实例名称 |

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

### 配置远程 OpenClaw Gateway

确保远程 Gateway 允许 WebSocket 连接：

1. **开放端口** - 确保防火墙开放 18789 端口
2. **配置 Token** - 在远程 Gateway 配置认证 Token（可选但推荐）
3. **WebSocket 地址** - 格式：`ws://IP:18789` 或 `wss://域名:443`

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
- **os-utils** - 系统资源监控

---

## 📝 版本更新日志

### v1.1.0 (2026-02-28)

**🎉 重大更新 - 多实例监控 + 现代化 UI**

**新功能**
- ✅ 多实例 WebSocket 长连接监控
- ✅ 实例配置持久化存储（instances.json）
- ✅ 每 30 秒自动检查所有实例状态
- ✅ 新增「官方链接」页面（GitHub/Docs/Discord/ClawHub）
- ✅ 新增 `/api/status/all` 接口一次性获取全部状态

**UI 改进**
- ✅ 现代化深色主题设计
- ✅ 毛玻璃效果卡片
- ✅ 优化系统资源展示（进度条 + 图标）
- ✅ 改进实例管理界面
- ✅ 响应式导航优化

**技术改进**
- ✅ 添加 node-fetch 和 os-utils 依赖
- ✅ 改进错误处理和连接重试机制
- ✅ 优化 API 响应结构

---

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
2. **防火墙** - 确保 VPS 防火墙开放 3001 端口
3. **HTTPS** - 生产环境强烈建议使用 HTTPS
4. **认证** - 远程实例建议配置 Gateway Token 进行认证
5. **权限** - 确保运行用户有权限执行 `openclaw` 命令
6. **依赖** - 需要 Node.js >= 22

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
- [React](https://react.dev/) - 用于构建用户界面的 JavaScript 库

---

**🦞 让 OpenClaw 监控变得简单！**

*最后更新：2026-02-28*

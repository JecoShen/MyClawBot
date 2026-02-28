# OpenClaw 监控面板 🦞

**一个独立的 OpenClaw 多实例监控面板，集中监控你所有的 OpenClaw 实例。**

---

## 🎯 产品定位

这不是某个 OpenClaw 实例的附属工具，而是一个**独立的监控产品**：

- ✅ 部署在一台独立的服务器（VPS/本地/树莓派）
- ✅ 监控任意位置的 OpenClaw 实例（家里、公司、其他 VPS）
- ✅ 即使某个 OpenClaw 实例挂了，监控面板依然在线
- ✅ 一个面板管理所有实例，状态一目了然

---

## ✨ 核心功能

### 🔐 安全认证
- 用户名密码登录
- 会话有效期 24 小时
- 支持自定义账号密码

### 🖥️ 多实例监控
- 添加任意数量的 OpenClaw 实例
- 实时在线/离线/错误状态
- 每 30 秒自动检查状态
- 支持 Gateway Token 认证

### 📊 状态概览
- 所有实例集中展示
- 状态图标一目了然
- 最后检查时间
- 错误信息显示

### 🔗 官方资源
- GitHub 仓库
- 官方文档
- Discord 社区
- ClawHub 技能市场

---

## 🚀 快速开始

### 方式一：Codespaces 体验

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/JecoShen/MyClawBot)

1. 点击上方按钮在 Codespaces 中打开
2. 等待服务启动
3. 访问：`https://3001-你的-Codespaces-ID.app.github.dev`
4. 登录：`admin` / `admin123`

### 方式二：VPS 部署（推荐）

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
npm start

# 或使用 PM2 守护进程
pm2 start dist/index.js --name openclaw-monitor
pm2 startup
pm2 save
```

访问：`http://你的 VPS-IP:3001`

---

## 🔧 配置

### 修改默认账号

```bash
# 方法 1：环境变量
export ADMIN_USER=your_username
export ADMIN_PASS=your_password
npm start

# 方法 2：systemd 服务
# 编辑 /etc/systemd/system/openclaw-monitor.service
[Service]
Environment="ADMIN_USER=your_username"
Environment="ADMIN_PASS=your_password"
```

### 添加监控实例

登录后在界面添加，需要提供：

| 字段 | 说明 | 示例 |
|------|------|------|
| 实例 ID | 唯一标识 | `home-server` |
| 名称 | 显示名称 | `家里服务器` |
| WebSocket 地址 | OpenClaw Gateway 地址 | `ws://192.168.1.100:18789` |
| Token | Gateway 认证 Token（可选） | `your-token` |

---

## 📡 API 文档

所有 API 需要登录后使用，在请求头中携带 `X-Session-Id`。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/check` | GET | 检查登录状态 |
| `/api/instances` | GET | 获取所有实例状态 |
| `/api/instances` | POST | 添加实例 |
| `/api/instances/:id` | DELETE | 删除实例 |
| `/api/instances/:id/status` | GET | 刷新实例状态 |
| `/api/version/latest` | GET | 获取最新版本信息 |
| `/api/links` | GET | 获取官方链接 |

---

## 🏠 典型使用场景

### 场景 1：监控家庭 OpenClaw

```
VPS（监控面板） ──────→ 家里宽带（OpenClaw）
     ↓
  公网 IP              内网穿透/端口转发
```

**配置：**
- 家里 OpenClaw 开启端口转发或使用内网穿透
- 监控面板添加：`ws://你的域名：18789`

### 场景 2：公司 + 家庭 + VPS 多实例

```
监控面板（部署在 VPS）
     ├─→ 公司 OpenClaw
     ├─→ 家里 OpenClaw
     └─→ 其他 VPS OpenClaw
```

**优势：**
- 集中管理，一个面板看所有
- 即使某个实例挂了，其他不受影响
- 随时查看各实例状态

### 场景 3：为客户部署监控

```
你的监控面板 VPS
     ├─→ 客户 A 的 OpenClaw
     ├─→ 客户 B 的 OpenClaw
     └─→ 客户 C 的 OpenClaw
```

**优势：**
- 统一管理所有客户实例
- 快速响应故障
- 专业形象

---

## ⚠️ 注意事项

1. **网络可达** - 确保监控面板能访问各 OpenClaw 实例的 WebSocket 端口
2. **防火墙** - 开放 18789 端口（或你配置的 Gateway 端口）
3. **Token 认证** - 建议为 Gateway 配置 Token，提高安全性
4. **HTTPS** - 生产环境建议使用 Nginx 反向代理 + HTTPS
5. **备份** - 定期备份 `instances.json` 配置文件

---

## 📦 技术栈

### 前端
- React 18
- Vite 5
- TailwindCSS 3
- TypeScript 5

### 后端
- Node.js 22+
- Express 4
- WebSocket
- TypeScript 5

---

## 📝 更新日志

### v1.2.0 (2026-02-28)

**🎉 重大更新 - 重新定位为独立监控产品**

**新功能**
- ✅ 用户名密码登录认证
- ✅ 会话管理（24 小时有效期）
- ✅ 支持自定义账号密码（环境变量）
- ✅ 完全移除本地实例概念
- ✅ 所有实例手动添加

**改进**
- ✅ 后端不再自动连接任何 Gateway
- ✅ 更清晰的产品定位
- ✅ 更适合多实例监控场景
- ✅ 优化的 UI/UX

**安全**
- ✅ 所有 API 需要认证
- ✅ 会话过期自动登出
- ✅ 支持 Gateway Token

### v1.1.0 (2026-02-28)

- 优化日志显示格式
- 添加日志级别过滤
- 增加 WebSocket 超时时间

### v1.0.0 (2026-02-27)

- 首次发布
- 基础监控功能
- 多实例支持

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

项目地址：https://github.com/JecoShen/MyClawBot

---

## 📄 许可证

MIT License

---

**🦞 让 OpenClaw 监控变得简单！**

*最后更新：2026-02-28*

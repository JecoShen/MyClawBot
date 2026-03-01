# OpenClaw 监控面板 🦞

**一个独立的 OpenClaw 多实例监控面板，集中监控你所有的 OpenClaw 实例。**

---

## 🎯 产品定位

这不是某个 OpenClaw 实例的附属工具，而是一个**独立的监控产品**：

- ✅ 部署在一台独立的服务器（VPS/本地/树莓派/宝塔面板）
- ✅ 监控任意位置的 OpenClaw 实例（家里、公司、其他 VPS）
- ✅ 即使某个 OpenClaw 实例挂了，监控面板依然在线
- ✅ 一个面板管理所有实例，状态一目了然
- ✅ **可选登录保护，默认无需登录**
- ✅ **简洁无 emoji 的现代化 UI**

---

## ✨ 核心功能

### 🔐 灵活认证
- **enableAdminLogin 开关控制登录**
- **默认关闭登录（无需登录即可访问）**
- 启用后需用户名密码登录
- 会话有效期 24 小时
- 支持在线修改密码（非配置文件模式）
- **无公开注册，防止未授权访问**

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

### 🌓 双主题模式
- 深色/浅色模式切换
- 偏好自动保存
- iOS 毛玻璃风格 UI
- 简洁专业设计

---

## 🚀 快速开始

### 方式一：一键部署（推荐）

**宝塔面板：**

```bash
# 1. 创建网站
# 网站 → 添加站点 → 填写域名 → 纯静态 → 提交

# 2. 部署项目
cd /www/wwwroot/你的域名
git clone https://github.com/JecoShen/MyClawBot.git .
cd openclaw-monitor

# 3. 安装依赖并构建
cd frontend && npm install --registry=https://registry.npmmirror.com && npm run build
cd ../backend && npm install --registry=https://registry.npmmirror.com && npm run build

# 4. 配置 Node.js 项目
# Node.js → 添加项目 → 项目目录：/www/wwwroot/你的域名/openclaw-monitor/backend
# 启动文件：dist/index.js → 端口：3001 → 开机启动：是

# 5. 配置反向代理
# 网站 → 设置 → 反向代理 → 添加反向代理
# 目标 URL：http://127.0.0.1:3001
```

**访问：** `http://你的域名`

**默认无需登录，直接进入主界面。**

---

### 方式二：Docker 部署

```bash
# 创建并运行容器
docker run -d \
  --name openclaw-monitor \
  -p 3001:3001 \
  -v openclaw-data:/app/openclaw-monitor/backend \
  --restart always \
  ghcr.io/jecoshen/myclawbot:latest
```

**访问：** `http://你的 IP:3001`

---

### 方式三：手动部署（VPS）

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

**访问：** `http://你的 IP:3001`

---

## 🔧 配置

### 管理员登录配置

编辑 `backend/config.json` 文件：

```json
{
  "enableAdminLogin": false,
  "adminUser": "",
  "adminPass": "",
  "allowRegister": false
}
```

**字段说明：**

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `enableAdminLogin` | 是否启用管理员登录 | `false` |
| `adminUser` | 管理员用户名 | `""` |
| `adminPass` | 密码的 SHA256 哈希 | `""` |
| `allowRegister` | 是否允许在线注册（已废弃） | `false` |

---

### 使用场景

#### 场景 1：个人使用（推荐）

**配置：**
```json
{
  "enableAdminLogin": false
}
```

**说明：**
- 访问面板无需登录
- 直接进入主界面
- 适合个人私有部署
- 最简单的使用方式

---

#### 场景 2：需要登录保护

**配置：**
```json
{
  "enableAdminLogin": true,
  "adminUser": "admin",
  "adminPass": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  "allowRegister": false
}
```

**说明：**
- 访问面板显示登录页面
- 需要输入账号密码
- 适合多人环境或公网部署
- 提高安全性

**生成密码哈希：**
```bash
# Linux/macOS
echo -n "your_password" | sha256sum

# 在线工具
# https://sha256online.com/
```

---

### ⚠️ 重要提示

**修改 config.json 后必须重启服务！**

```bash
# 编辑配置
nano backend/config.json

# 重启服务（PM2）
pm2 restart openclaw-monitor

# 重启服务（直接运行）
pkill -f "node dist/index.js"
cd backend && npm start
```

**不重启配置不会生效**，因为配置文件是在服务启动时加载的。

---

## 📖 OpenClaw 实例配置

### 获取 WebSocket 地址

**本地部署（同一台服务器）：**
```
ws://127.0.0.1:18789
```

**内网部署（同一局域网）：**
```
ws://192.168.1.100:18789
```

**公网部署（不同网络）：**
```
ws://你的公网 IP:18789
# 或
wss://your-domain.com:18789
```

**配置端口转发：**
1. 登录路由器管理后台
2. 找到 **端口转发** / **虚拟服务器** 设置
3. 添加规则：内部 IP → 内部端口 `18789` → 外部端口 `18789` → 协议 `TCP`

---

### 配置 Gateway Token（可选）

**生成 Token：**
```bash
openssl rand -hex 16
```

**配置 OpenClaw：**
```bash
nano ~/.openclaw/openclaw.json
```

```json
{
  "gateway": {
    "bind": "0.0.0.0",
    "port": 18789,
    "token": "your-secret-token-here"
  }
}
```

**重启 Gateway：**
```bash
openclaw gateway restart
```

---

### 添加监控实例

1. 访问监控面板
2. 点击 **实例** 标签
3. 点击 **添加实例**
4. 填写信息：
   - **实例 ID**：唯一标识（如 `home-server`）
   - **名称**：显示名称（如 `家里服务器`）
   - **WebSocket 地址**：`ws://IP:18789`
   - **Gateway Token**：如果配置了就填写
5. 点击 **确认添加**

---

## 📡 API 文档

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录（启用登录时） |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/check` | GET | 检查登录状态 |
| `/api/instances` | GET | 获取所有实例状态 |
| `/api/instances` | POST | 添加实例 |
| `/api/instances/:id` | DELETE | 删除实例 |
| `/api/instances/:id/status` | GET | 刷新实例状态 |

**请求头：**
```
X-Session-Id: your-session-id
```

---

## 🏠 典型使用场景

### 场景 1：监控家庭 OpenClaw

```
VPS（监控面板） ──────→ 家里宽带（OpenClaw）
     ↓
  公网 IP              内网穿透/端口转发
```

---

### 场景 2：多实例监控

```
监控面板（部署在 VPS）
     ├─→ 公司 OpenClaw
     ├─→ 家里 OpenClaw
     └─→ 其他 VPS OpenClaw
```

---

### 场景 3：为客户部署监控

```
你的监控面板 VPS
     ├─→ 客户 A 的 OpenClaw
     ├─→ 客户 B 的 OpenClaw
     └─→ 客户 C 的 OpenClaw
```

---

## ⚠️ 注意事项

1. **网络可达** - 确保监控面板能访问各 OpenClaw 实例的 WebSocket 端口
2. **防火墙** - 开放 18789 端口（或你配置的 Gateway 端口）
3. **Token 认证** - 建议为 Gateway 配置 Token，提高安全性
4. **HTTPS** - 生产环境建议使用 Nginx 反向代理 + HTTPS
5. **备份** - 定期备份 `instances.json`、`data.json` 和 `config.json`
6. **重启生效** - 修改 `config.json` 后必须重启服务

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

### v1.4.1 (2026-03-01)

**🔐 登录逻辑修复**

**修复**
- ✅ enableAdminLogin: false 时直接进入主界面
- ✅ enableAdminLogin: true 时显示登录页面
- ✅ 修复 API headers 类型错误

**说明**
- ✅ 默认无需登录即可访问
- ✅ 启用登录后需要账号密码
- ✅ 修改 config.json 后需重启服务

### v1.4.0 (2026-03-01)

**🔐 安全升级 - 配置文件认证模式**

**新功能**
- ✅ config.json 配置管理员账号
- ✅ 关闭公开注册，防止未授权访问
- ✅ 一个面板绑定一个管理员账号
- ✅ 支持 SHA256 密码哈希

### v1.3.0 (2026-02-28)

**🎨 UI 全面升级 - 苹果 iOS 毛玻璃风格**

**设计改进**
- ✅ 毛玻璃效果 (Glassmorphism)
- ✅ iOS 风格组件
- ✅ 双主题模式（深色/浅色）
- ✅ 流畅动画

### v1.2.0 (2026-02-28)

**🎉 重大更新 - 重新定位为独立监控产品**

**新功能**
- ✅ 用户名密码登录认证
- ✅ 会话管理（24 小时有效期）
- ✅ 完全移除本地实例概念
- ✅ 所有实例手动添加

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

*最后更新：2026-03-01*

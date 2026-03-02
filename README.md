# OpenClaw Monitor 🦞

**一个独立的 OpenClaw 多实例集中监控面板**

---

## ✨ 核心功能

### 📊 实时监控
- 多实例状态总览（在线/离线/警告）
- 每 30 秒自动检测
- 连接质量显示

### ⚠️ 错误中心
- 自动捕获 WebSocket 连接错误
- 一键复制完整上下文（给 AI 分析）
- 错误标记已解决
- 历史错误记录

### 📦 版本管理
- 自动检测 GitHub 最新版本
- Release Notes 显示
- 更新提醒

### 🎨 现代化 UI
- iOS 毛玻璃风格
- 深色/浅色模式切换
- 响应式设计

### 🔐 灵活认证
- 配置文件设置管理员账号
- 可选登录（默认关闭）
- 会话有效期 24 小时

---

## 🚀 快速开始

### 方式一：手动部署

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
```

**访问：** `http://localhost:3001`

---

### 方式二：宝塔面板

```bash
# 1. 创建网站（纯静态）

# 2. 部署项目
cd /www/wwwroot/你的域名
git clone https://github.com/JecoShen/MyClawBot.git .
cd openclaw-monitor

# 3. 安装依赖并构建
cd frontend && npm install --registry=https://registry.npmmirror.com && npm run build
cd ../backend && npm install --registry=https://registry.npmmirror.com && npm run build

# 4. 配置 Node.js 项目
# Node.js → 添加项目 → 项目目录：/www/wwwroot/你的域名/openclaw-monitor/backend
# 启动文件：dist/index.js → 端口：3001

# 5. 配置反向代理
# 网站 → 设置 → 反向代理 → 目标 URL：http://127.0.0.1:3001
```

---

## 🔧 配置

### 管理员账号配置

编辑 `backend/config.json`：

```json
{
  "enableAdminLogin": false,
  "adminUser": "",
  "adminPass": "",
  "allowRegister": false
}
```

**启用登录：**
1. 设置 `enableAdminLogin: true`
2. 填写 `adminUser`（用户名）
3. 填写 `adminPass`（密码的 SHA256 哈希）

**生成密码哈希：**
```bash
echo -n "your_password" | sha256sum
```

**示例：**
```json
{
  "enableAdminLogin": true,
  "adminUser": "admin",
  "adminPass": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
  "allowRegister": false
}
```
（密码 `password` 的哈希）

---

### 添加监控实例

1. 访问监控面板
2. 点击 **实例** 标签
3. 点击 **添加实例**
4. 填写：
   - **实例 ID**：唯一标识（如 `home-server`）
   - **名称**：显示名称（如 `家里服务器`）
   - **WebSocket 地址**：`ws://IP:18789`
   - **Gateway Token**：如果配置了就填写

---

## 📖 OpenClaw 配置

### Gateway 配置

编辑 `~/.openclaw/openclaw.json`：

```json
"gateway": {
  "port": 18789,
  "mode": "local",
  "bind": "loopback",
  "auth": {
    "mode": "token",
    "token": "your-token"
  }
}
```

### 远程访问 Dashboard

**SSH 端口转发：**
```bash
ssh -L 18789:127.0.0.1:18789 user@your-vps-ip
```

**访问：** `http://127.0.0.1:18789/?token=your-token`

---

## 📡 API 文档

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/status` | GET | 检查登录状态 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 登出 |
| `/api/instances` | GET | 获取所有实例 |
| `/api/instances` | POST | 添加实例 |
| `/api/instances/:id` | DELETE | 删除实例 |
| `/api/instances/:id/status` | GET | 刷新状态 |
| `/api/errors` | GET | 获取错误日志 |
| `/api/errors/:id/resolve` | POST | 标记错误已解决 |
| `/api/version` | GET | 获取版本信息 |

---

## 📝 更新日志

### v2.0.0 (2026-03-02)

**🎉 重大重构 - 全新的监控面板**

**新功能**
- ✅ 错误中心（自动捕获 + 一键复制）
- ✅ 实例状态总览
- ✅ 版本管理
- ✅ 深色/浅色模式切换
- ✅ iOS 毛玻璃风格 UI

**改进**
- ✅ 简化认证流程
- ✅ 优化前端架构
- ✅ 更好的错误处理

### v1.4.1 (2026-03-01)

- 修复登录逻辑冲突
- 默认无需登录即可访问

### v1.4.0 (2026-03-01)

- 配置文件认证模式
- 关闭公开注册

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

项目地址：https://github.com/JecoShen/MyClawBot

---

## 📄 许可证

MIT License

---

**🦞 让 OpenClaw 监控变得简单！**

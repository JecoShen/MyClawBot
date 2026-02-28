# OpenClaw 监控面板 🦞

**一个独立的 OpenClaw 多实例监控面板，集中监控你所有的 OpenClaw 实例。**

---

## 🎯 产品定位

这不是某个 OpenClaw 实例的附属工具，而是一个**独立的监控产品**：

- ✅ 部署在一台独立的服务器（VPS/本地/树莓派/宝塔面板）
- ✅ 监控任意位置的 OpenClaw 实例（家里、公司、其他 VPS）
- ✅ 即使某个 OpenClaw 实例挂了，监控面板依然在线
- ✅ 一个面板管理所有实例，状态一目了然

---

## ✨ 核心功能

### 🔐 安全认证
- 首次访问自动注册账号
- 用户名密码登录
- 会话有效期 24 小时
- 支持在线修改密码

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

## 🚀 部署方式

### 方式一：宝塔面板部署（推荐 ⭐）

**前置要求：** 已安装宝塔面板（https://www.bt.cn）

#### 步骤 1：安装 Node.js

1. 登录宝塔面板
2. 左侧菜单 → **软件商店**
3. 搜索 **Node.js**
4. 点击 **安装**（推荐版本 20+）

#### 步骤 2：创建网站

1. 左侧菜单 → **网站** → **添加站点**
2. 填写域名（或直接用 IP）
3. 运行环境选择 **纯静态**
4. 数据库选择 **无需**
5. 点击 **提交**

#### 步骤 3：部署项目

1. 进入刚创建的网站目录（如：`/www/wwwroot/your-domain.com`）
2. 点击 **终端** 或通过 SSH 连接
3. 执行以下命令：

```bash
# 克隆项目
git clone https://github.com/JecoShen/MyClawBot.git .

# 进入监控面板目录
cd openclaw-monitor

# 安装前端依赖并构建
cd frontend
npm install --registry=https://registry.npmmirror.com
npm run build

# 安装后端依赖
cd ../backend
npm install --registry=https://registry.npmmirror.com
npm run build
```

#### 步骤 4：配置 Node.js 项目

1. 左侧菜单 → **Node.js**
2. 点击 **添加 Node.js 项目**
3. 配置如下：
   - **项目目录**：`/www/wwwroot/your-domain.com/openclaw-monitor/backend`
   - **启动文件**：`dist/index.js`
   - **端口**：`3001`
   - **是否开机启动**：✅ 是
   - **项目别名**：`openclaw-monitor`

4. 点击 **提交**

#### 步骤 5：配置反向代理

1. 左侧菜单 → **网站**
2. 点击刚创建的网站 → **设置**
3. 左侧菜单 → **反向代理**
4. 点击 **添加反向代理**
5. 配置如下：
   - **代理名称**：`monitor`
   - **目标 URL**：`http://127.0.0.1:3001`
   - **发送域名**：`$host`
   - **代理目录**：留空（代理整个站点）

6. 点击 **提交**

#### 步骤 6：配置防火墙

1. 左侧菜单 → **安全**
2. 放行端口：
   - 如果使用域名访问，只需放行 `80` 和 `443`
   - 如果直接 IP 访问，放行 `3001`

#### ✅ 完成！

访问：`http://你的域名` 或 `http://你的 IP:3001`

**首次访问会自动进入注册页面，创建你的管理员账号。**

---

### 方式二：Docker 部署

```bash
# 1. 创建 Dockerfile
cat > Dockerfile << 'DOCKERFILE'
FROM node:22-alpine

WORKDIR /app

# 复制源码
COPY . .

# 安装依赖并构建
RUN cd openclaw-monitor/frontend && npm install --registry=https://registry.npmmirror.com && npm run build
RUN cd openclaw-monitor/backend && npm install --registry=https://registry.npmmirror.com && npm run build

# 暴露端口
EXPOSE 3001

# 启动服务
WORKDIR /app/openclaw-monitor/backend
CMD ["node", "dist/index.js"]
DOCKERFILE

# 2. 构建镜像
docker build -t openclaw-monitor .

# 3. 运行容器
docker run -d \
  --name openclaw-monitor \
  -p 3001:3001 \
  -v openclaw-data:/app/openclaw-monitor/backend \
  --restart always \
  openclaw-monitor
```

访问：`http://你的 IP:3001`

**首次访问会自动进入注册页面，创建你的管理员账号。**

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

访问：`http://你的 IP:3001`

**首次访问会自动进入注册页面，创建你的管理员账号。**

---

### 方式四：Codespaces 体验

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/JecoShen/MyClawBot)

1. 点击上方按钮在 Codespaces 中打开
2. 等待服务启动
3. 访问：`https://3001-你的-Codespaces-ID.app.github.dev`
4. **首次访问请注册账号**

---

## 🔧 配置

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
| `/api/auth/register` | POST | 注册账号 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/check` | GET | 检查登录状态 |
| `/api/auth/change-password` | POST | 修改密码 |
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
4. **HTTPS** - 生产环境建议使用 Nginx 反向代理 + HTTPS（宝塔自动处理）
5. **备份** - 定期备份 `instances.json` 和 `data.json` 配置文件
6. **账号安全** - 首次访问请注册强密码，妥善保管账号信息

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

### v1.3.0 (2026-02-28)

**🎨 UI 全面升级 - 苹果 iOS 毛玻璃风格**

**设计改进**
- ✅ 毛玻璃效果 (Glassmorphism)
- ✅ iOS 风格组件
- ✅ 渐变背景
- ✅ 流畅动画

**功能改进**
- ✅ 用户注册制（无默认账号）
- ✅ 在线修改密码
- ✅ 用户下拉菜单
- ✅ 头像首字母显示

### v1.2.0 (2026-02-28)

**🎉 重大更新 - 重新定位为独立监控产品**

**新功能**
- ✅ 用户名密码登录认证
- ✅ 会话管理（24 小时有效期）
- ✅ 完全移除本地实例概念
- ✅ 所有实例手动添加

**改进**
- ✅ 后端不再自动连接任何 Gateway
- ✅ 更清晰的产品定位
- ✅ 更适合多实例监控场景

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

---

## 📖 OpenClaw 实例配置详细教程

### 前置准备

在添加实例之前，你需要确保 OpenClaw 实例满足以下条件：

#### 1️⃣ 确认 OpenClaw 版本

```bash
# SSH 登录到你的 OpenClaw 服务器
openclaw --version
```

**要求：** OpenClaw 版本 >= 2026.2.0

**升级命令：**
```bash
openclaw update run
```

---

#### 2️⃣ 获取 WebSocket 地址

**什么是 WebSocket 地址？**

WebSocket 地址是监控面板连接 OpenClaw Gateway 的 URL，格式如下：

```
ws://IP 地址：端口
或
wss://域名：端口
```

**如何获取：**

**方法 A：本地部署（同一台服务器）**

如果监控面板和 OpenClaw 在同一台服务器：
```
ws://127.0.0.1:18789
```

**方法 B：内网部署（同一局域网）**

如果监控面板和 OpenClaw 在同一局域网：
```bash
# 在 OpenClaw 服务器上查看内网 IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# 输出示例：inet 192.168.1.100/24
# 那么 WebSocket 地址是：
ws://192.168.1.100:18789
```

**方法 C：公网部署（不同网络）**

如果监控面板和 OpenClaw 不在同一网络（如 VPS 监控家里的 OpenClaw）：

**步骤 1：配置端口转发（家庭宽带）**

1. 登录路由器管理后台（通常是 `192.168.1.1` 或 `192.168.0.1`）
2. 找到 **端口转发** / **虚拟服务器** / **NAT** 设置
3. 添加规则：
   - **内部 IP**：OpenClaw 服务器的内网 IP（如 `192.168.1.100`）
   - **内部端口**：`18789`
   - **外部端口**：`18789`
   - **协议**：TCP

**步骤 2：获取公网 IP**

```bash
# 在 OpenClaw 服务器上执行
curl ifconfig.me
# 或访问 https://ip138.com
```

**步骤 3：填写 WebSocket 地址**

```
ws://你的公网 IP:18789
```

**⚠️ 注意：** 家庭宽带的公网 IP 可能会变化，建议使用 DDNS（动态域名解析）

**方法 D：使用域名（推荐）**

如果有域名，可以配置 DDNS：

```
wss://your-domain.com:18789
```

---

#### 3️⃣ 获取 Gateway Token（可选但推荐）

**什么是 Gateway Token？**

Gateway Token 是 OpenClaw 的认证令牌，用于验证监控面板的连接请求。配置后，只有知道 Token 的面板才能连接，提高安全性。

**如何获取/配置 Token：**

**步骤 1：查看当前配置**

```bash
# SSH 登录 OpenClaw 服务器
cat ~/.openclaw/openclaw.json
```

**步骤 2：配置 Token**

编辑配置文件：
```bash
nano ~/.openclaw/openclaw.json
```

找到或添加 `gateway` 配置：
```json
{
  "gateway": {
    "bind": "0.0.0.0",
    "port": 18789,
    "token": "your-secret-token-here"
  }
}
```

**Token 生成建议：**
- 长度：至少 16 位
- 包含：大小写字母 + 数字
- 示例：`MyClaw2026SecureToken#888`

**快速生成随机 Token：**
```bash
# 生成随机字符串
openssl rand -hex 16
# 输出示例：a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**步骤 3：重启 Gateway**

```bash
openclaw gateway restart
```

**步骤 4：验证 Token 是否生效**

```bash
openclaw gateway status
```

看到类似输出表示成功：
```
Gateway: bind=0.0.0.0, port=18789
Token: configured ✓
```

---

#### 4️⃣ 防火墙配置

**确保 18789 端口开放：**

**Linux (UFW)：**
```bash
sudo ufw allow 18789/tcp
sudo ufw status
```

**Linux (Firewalld)：**
```bash
sudo firewall-cmd --permanent --add-port=18789/tcp
sudo firewall-cmd --reload
```

**云服务器（阿里云/腾讯云/AWS 等）：**

1. 登录云服务商控制台
2. 找到 **安全组** / **防火墙** 设置
3. 添加入站规则：
   - **协议**：TCP
   - **端口**：`18789`
   - **来源**：`0.0.0.0/0`（或监控面板的 IP）

---

### 📋 完整配置检查清单

在添加实例之前，请确认：

- [ ] OpenClaw 版本 >= 2026.2.0
- [ ] Gateway 正在运行 (`openclaw gateway status`)
- [ ] 知道 WebSocket 地址（`ws://IP:18789`）
- [ ] （可选）已配置 Gateway Token
- [ ] 防火墙已开放 18789 端口
- [ ] 监控面板能访问 OpenClaw 服务器（网络可达）

---

### 🔧 在监控面板中添加实例

**步骤 1：注册/登录监控面板**

访问：`http://你的监控面板地址`

- **首次访问**：点击「注册」，创建你的管理员账号
- **已有账号**：点击「登录」，输入用户名和密码

**步骤 2：进入实例管理**

点击顶部导航栏的 **💻 实例** 标签

**步骤 3：添加实例**

点击 **+ 添加实例** 按钮，填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| **实例 ID** | 唯一标识，只能用英文和数字 | `home-server` |
| **名称** | 显示名称，可以是中文 | `家里服务器` |
| **WebSocket 地址** | 必须包含 `ws://` 或 `wss://` | `ws://192.168.1.100:18789` |
| **Gateway Token** | 如果配置了就填写，否则留空 | `MySecretToken123` |

**步骤 4：确认状态**

添加后，实例卡片会显示状态：

- 🟢 **● 在线** - 连接成功
- 🔴 **○ 离线** - 无法连接（检查网络和端口）
- 🟡 **⚠ 错误** - 认证失败（检查 Token）

---

### 🐛 常见问题排查

#### 问题 1：显示「离线」

**可能原因：**
1. 网络不可达
2. 端口未开放
3. Gateway 未运行

**解决方法：**
```bash
# 1. 检查 Gateway 状态
openclaw gateway status

# 2. 检查端口监听
netstat -tlnp | grep 18789

# 3. 从监控面板服务器测试连接
telnet OpenClaw-IP 18789
# 或
nc -zv OpenClaw-IP 18789
```

#### 问题 2：显示「错误：Authentication failed」

**原因：** Token 不匹配

**解决方法：**
1. 确认 OpenClaw 配置的 Token
2. 在监控面板中删除该实例
3. 重新添加，填写正确的 Token

#### 问题 3：家庭宽带无法连接

**可能原因：**
1. 没有公网 IP
2. 路由器未配置端口转发
3. 防火墙阻止

**解决方法：**
1. 联系运营商申请公网 IP
2. 配置路由器端口转发
3. 使用内网穿透工具（如 frp、ngrok）

---

### 📞 需要帮助？

如果遇到问题：

1. **查看日志** - 在 OpenClaw 服务器上：
   ```bash
   tail -f /tmp/openclaw/openclaw-*.log
   ```

2. **官方文档** - https://docs.openclaw.ai

3. **Discord 社区** - https://discord.com/invite/clawd

4. **提交 Issue** - https://github.com/openclaw/openclaw/issues

---

**🦞 配置完成！享受集中监控的便利！**

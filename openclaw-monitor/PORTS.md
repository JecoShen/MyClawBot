# 🔓 Codespaces 端口配置指南

## 为什么打不开公网链接？

GitHub Codespaces 默认将端口设为 **Private（私有）**，外部无法访问。

## 解决方法

### 方法一：在 Codespaces 界面设置（推荐）

1. 打开你的 Codespaces 页面
2. 点击底部 **PORTS** 标签
3. 找到 **3001** 端口
4. 右键点击 → **Port Visibility** → 选择 **Public**
5. 访问：`https://organic-spoon-xjprjrg46wq3v6xw-3001.app.github.dev`

### 方法二：使用 VS Code 端口转发

1. 在 VS Code 中，点击底部 **Ports** 标签
2. 点击 **Forward a Port**
3. 输入 `3001`
4. 点击端口旁边的地球图标 🔓 设为 Public

### 方法三：直接访问前端开发服务器

如果后端端口有问题，可以访问前端开发服务器：
- `https://organic-spoon-xjprjrg46wq3v6xw-5173.app.github.dev`

但需要配置代理才能调用 API。

---

## ✅ 当前运行状态

| 服务 | 端口 | 状态 |
|------|------|------|
| 后端 API | 3001 | ✅ 运行中 |
| 前端开发 | 5173 | ✅ 运行中 |

**API 测试：**
```bash
curl https://organic-spoon-xjprjrg46wq3v6xw-3001.app.github.dev/api/status/all
```

---

## 🚀 生产部署（VPS）

如果在 VPS 上部署，直接使用：
```bash
http://你的服务器IP:3001
```

或使用 Nginx 反向代理 + 域名访问。

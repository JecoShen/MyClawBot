#!/bin/bash

echo "🦞 OpenClaw Monitor 部署脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 2. 安装后端依赖
echo "📦 安装后端依赖..."
cd backend
npm install --registry=https://registry.npmmirror.com
npm run build

# 3. 安装前端依赖并构建
echo "📦 安装前端依赖并构建..."
cd ../frontend
npm install --registry=https://registry.npmmirror.com
npm run build

# 4. 创建配置文件（如果不存在）
cd ../backend
if [ ! -f config.json ]; then
  echo "📝 创建配置文件..."
  cat > config.json << 'CONFIG'
{
  "enableAdminLogin": false,
  "adminUser": "",
  "adminPass": "",
  "allowRegister": false
}
CONFIG
fi

# 5. 启动服务
echo "🚀 启动服务..."
pkill -f "node dist/index.js" 2>/dev/null
nohup node dist/index.js > ../monitor.log 2>&1 &

sleep 3

# 6. 检查状态
if pgrep -f "node dist/index.js" > /dev/null; then
  echo ""
  echo "✅ 部署成功！"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📡 服务运行在端口 3001"
  echo "🌐 访问：http://$(hostname -I | awk '{print $1}'):3001"
  echo "📋 日志：tail -f ../monitor.log"
else
  echo "❌ 启动失败，请查看日志"
fi

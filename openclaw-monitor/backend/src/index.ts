import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// 认证配置
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

app.use(cors());
app.use(express.json());

// 会话存储
const sessions: Map<string, { user: string; loginAt: number }> = new Map();

// ========== 实例配置 ==========

interface MonitoredInstance {
  id: string;
  name: string;
  url: string;          // WebSocket 地址，如 ws://192.168.1.100:18789
  token?: string;       // Gateway Token（可选）
  status: 'online' | 'offline' | 'error';
  error?: string;
  lastSeen?: number;
  ws?: WebSocket;
  reconnectAttempts: number;
}

const instances: MonitoredInstance[] = [];
const INSTANCES_FILE = path.join(__dirname, '../instances.json');

// ========== 工具函数 ==========

async function saveInstances() {
  try {
    const data = instances.map(i => ({ id: i.id, name: i.name, url: i.url, token: i.token || '' }));
    await execAsync(`echo '${JSON.stringify(data, null, 2)}' > ${INSTANCES_FILE}`);
  } catch (err) { console.error('Failed to save instances:', err); }
}

async function loadInstances() {
  try {
    const { stdout } = await execAsync(`cat ${INSTANCES_FILE} 2>/dev/null || echo '[]'`);
    const data = JSON.parse(stdout.trim() || '[]');
    data.forEach((d: any) => {
      instances.push({ ...d, status: 'offline', reconnectAttempts: 0 });
    });
    console.log(`📦 加载了 ${instances.length} 个监控实例`);
  } catch (err) { console.error('Failed to load instances:', err); }
}

// 连接并检查实例状态
function checkInstance(instance: MonitoredInstance): Promise<'online' | 'offline' | 'error'> {
  return new Promise((resolve) => {
    if (instance.ws) {
      instance.ws.removeAllListeners();
      instance.ws.close();
    }

    const ws = new WebSocket(instance.url, {
      headers: instance.token ? { 'Authorization': `Bearer ${instance.token}` } : {},
      handshakeTimeout: 10000
    });

    instance.ws = ws;
    const timeout = setTimeout(() => {
      ws.close();
      instance.status = 'offline';
      instance.error = '连接超时';
      resolve('offline');
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      instance.status = 'online';
      instance.error = undefined;
      instance.lastSeen = Date.now();
      instance.reconnectAttempts = 0;
      resolve('online');
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      instance.status = 'error';
      instance.error = err.message;
      instance.lastSeen = Date.now();
      resolve('error');
    });

    ws.on('close', () => {
      if (instance.status === 'online') {
        instance.status = 'offline';
        instance.error = '连接已关闭';
        instance.lastSeen = Date.now();
      }
    });
  });
}

// 格式化日志
function formatLogs(rawLogs: string): string {
  const lines = rawLogs.trim().split('\n');
  const formatted: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const log = JSON.parse(line);
      const time = log._meta?.time ? new Date(log._meta.time).toLocaleTimeString('zh-CN') : '???';
      const level = log._meta?.logLevelName || 'INFO';
      const message = log['0'] || '';
      const levelIcon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'DEBUG' ? '' : 'ℹ️';
      if (level === 'DEBUG') continue;
      formatted.push(`[${time}] ${levelIcon} ${message}`);
    } catch { formatted.push(line); }
  }
  return formatted.join('\n') || '-- 暂无日志 --';
}

// 获取 GitHub 最新版本
async function getLatestRelease() {
  try {
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'OpenClaw-Monitor/1.0' };
    const response = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest', { headers });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data: any = await response.json();
    return {
      version: data.tag_name || 'unknown',
      publishedAt: data.published_at,
      body: data.body || '',
      url: data.html_url
    };
  } catch (err: any) {
    return { version: '获取失败', publishedAt: null, body: err.message, url: 'https://github.com/openclaw/openclaw/releases' };
  }
}

// ========== 认证中间件 ==========

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: '未授权' });
  }
  const session = sessions.get(sessionId)!;
  if (Date.now() - session.loginAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return res.status(401).json({ error: '会话已过期' });
  }
  next();
}

// ========== 认证路由 ==========

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { user: username, loginAt: Date.now() });
    res.json({ success: true, sessionId, user: username });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) sessions.delete(sessionId);
  res.json({ success: true });
});

app.get('/api/auth/check', (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    if (Date.now() - session.loginAt < 24 * 60 * 60 * 1000) {
      return res.json({ authenticated: true, user: session.user });
    }
    sessions.delete(sessionId);
  }
  res.json({ authenticated: false });
});

// ========== API 路由（需要认证）==========

// 获取所有监控实例状态
app.get('/api/instances', requireAuth, async (req, res) => {
  // 并行检查所有实例状态
  await Promise.all(instances.map(inst => checkInstance(inst)));
  
  res.json(instances.map(i => ({
    id: i.id,
    name: i.name,
    url: i.url,
    status: i.status,
    error: i.error,
    lastSeen: i.lastSeen
  })));
});

// 添加实例
app.post('/api/instances', requireAuth, async (req, res) => {
  const { id, name, url, token } = req.body;
  if (!id || !url) {
    return res.status(400).json({ error: '实例 ID 和 WebSocket 地址是必填项' });
  }
  
  const existing = instances.find(i => i.id === id);
  if (existing) {
    return res.status(400).json({ error: '实例已存在' });
  }

  const instance: MonitoredInstance = {
    id,
    name: name || id,
    url,
    token: token || '',
    status: 'offline',
    reconnectAttempts: 0
  };
  
  // 立即检查状态
  await checkInstance(instance);
  
  instances.push(instance);
  await saveInstances();
  res.json(instance);
});

// 删除实例
app.delete('/api/instances/:id', requireAuth, async (req, res) => {
  const index = instances.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '实例不存在' });
  }
  
  const instance = instances[index];
  if (instance.ws) instance.ws.close();
  
  instances.splice(index, 1);
  await saveInstances();
  res.json({ success: true });
});

// 刷新单个实例状态
app.get('/api/instances/:id/status', requireAuth, async (req, res) => {
  const instance = instances.find(i => i.id === req.params.id);
  if (!instance) {
    return res.status(404).json({ error: '实例不存在' });
  }

  await checkInstance(instance);
  res.json({
    id: instance.id,
    name: instance.name,
    url: instance.url,
    status: instance.status,
    error: instance.error,
    lastSeen: instance.lastSeen
  });
});

// 获取版本信息
app.get('/api/version/latest', requireAuth, async (req, res) => {
  const release = await getLatestRelease();
  res.json({
    current: 'N/A (远程监控)',
    latest: release,
    updateAvailable: release.version !== '获取失败'
  });
});

// 获取实例日志（需要实例支持日志 API）
app.get('/api/logs', requireAuth, async (req, res) => {
  res.json({ logs: '-- 日志功能需要实例支持 --\n\n提示：可以在各 OpenClaw 实例上查看本地日志' });
});

// 官方链接
app.get('/api/links', requireAuth, (req, res) => {
  res.json({
    github: 'https://github.com/openclaw/openclaw',
    releases: 'https://github.com/openclaw/openclaw/releases',
    docs: 'https://docs.openclaw.ai',
    discord: 'https://discord.com/invite/clawd',
    clawhub: 'https://clawhub.com'
  });
});

// ========== 静态文件服务 ==========

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// ========== 启动 ==========

async function start() {
  await loadInstances();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🦞 OpenClaw 监控面板 已启动');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 端口：${PORT}`);
    console.log(`👤 账号：${ADMIN_USER} / ${ADMIN_PASS}`);
    console.log(`🌐 公网：https://3001-organic-spoon-xjprjrg46wq3v6xw.app.github.dev`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 提示：登录后添加要监控的 OpenClaw 实例');
    console.log('');
  });
  
  // 每 30 秒自动检查所有实例
  setInterval(async () => {
    await Promise.all(instances.map(inst => checkInstance(inst)));
  }, 30000);
}

start();

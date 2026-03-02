import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// 配置文件
const CONFIG_FILE = path.join(__dirname, '../config.json');
const DEFAULT_CONFIG = {
  enableAdminLogin: false,
  adminUser: '',
  adminPass: '',
  allowRegister: false
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
    }
  } catch (err) { console.error('Failed to load config:', err); }
  return DEFAULT_CONFIG;
}

let config = loadConfig();

app.use(cors());
app.use(express.json());

// 会话存储
const sessions: Map<string, { username: string; loginAt: number }> = new Map();

// 实例配置
interface MonitoredInstance {
  id: string;
  name: string;
  url: string;
  token?: string;
  status: 'online' | 'offline' | 'error';
  error?: string;
  lastSeen?: number;
  ws?: WebSocket;
  reconnectAttempts: number;
  metrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    uptime?: string;
  };
}

const instances: MonitoredInstance[] = [];
const INSTANCES_FILE = path.join(__dirname, '../instances.json');
const ERRORS_FILE = path.join(__dirname, '../errors.json');

// 错误日志存储
interface ErrorLog {
  id: string;
  instanceId: string;
  instanceName: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  context: string;
  timestamp: number;
  resolved: boolean;
}

let errorLogs: ErrorLog[] = [];

// 加载数据
async function loadData() {
  try {
    const { stdout } = await execAsync(`cat ${INSTANCES_FILE} 2>/dev/null || echo '[]'`);
    const data = JSON.parse(stdout.trim() || '[]');
    data.forEach((d: any) => {
      instances.push({ ...d, status: 'offline', reconnectAttempts: 0 });
    });
    console.log(`📦 加载了 ${instances.length} 个监控实例`);
  } catch (err) { console.error('Failed to load instances:', err); }

  try {
    const { stdout } = await execAsync(`cat ${ERRORS_FILE} 2>/dev/null || echo '[]'`);
    errorLogs = JSON.parse(stdout.trim() || '[]');
    console.log(`📦 加载了 ${errorLogs.length} 条错误记录`);
  } catch (err) { errorLogs = []; }
}

// 保存数据
async function saveInstances() {
  try {
    const data = instances.map(({ id, name, url, token }) => ({ id, name, url, token: token || '' }));
    await execAsync(`echo '${JSON.stringify(data, null, 2)}' > ${INSTANCES_FILE}`);
  } catch (err) { console.error('Failed to save instances:', err); }
}

async function saveErrors() {
  try {
    await execAsync(`echo '${JSON.stringify(errorLogs, null, 2)}' > ${ERRORS_FILE}`);
  } catch (err) { console.error('Failed to save errors:', err); }
}

// 检查实例状态
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
      instance.lastSeen = Date.now();
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
      
      // 记录错误
      const errorLog: ErrorLog = {
        id: crypto.randomBytes(8).toString('hex'),
        instanceId: instance.id,
        instanceName: instance.name,
        level: 'error',
        message: `WebSocket 连接失败：${err.message}`,
        context: `目标地址：${instance.url}\n时间：${new Date().toISOString()}`,
        timestamp: Date.now(),
        resolved: false
      };
      errorLogs.unshift(errorLog);
      if (errorLogs.length > 100) errorLogs.pop();
      saveErrors();
      
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

// 获取 GitHub 最新版本
async function getLatestRelease() {
  try {
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'OpenClaw-Monitor/1.0' };
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

// 认证中间件
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!config.enableAdminLogin) return next();
  
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

app.get('/api/auth/status', async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    if (Date.now() - session.loginAt < 24 * 60 * 60 * 1000) {
      return res.json({ hasUser: true, authenticated: true, username: session.username, enableAdminLogin: config.enableAdminLogin });
    }
    sessions.delete(sessionId);
  }
  
  res.json({ hasUser: config.enableAdminLogin && config.adminUser && config.adminPass, authenticated: false, enableAdminLogin: config.enableAdminLogin });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!config.enableAdminLogin) {
    return res.status(403).json({ error: '管理员登录未启用' });
  }
  
  if (config.adminUser && config.adminPass) {
    if (username !== config.adminUser || crypto.createHash('sha256').update(password).digest('hex') !== config.adminPass) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { username, loginAt: Date.now() });
    return res.json({ success: true, sessionId, username });
  }
  
  res.status(400).json({ error: '请先在 config.json 中配置管理员账号' });
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId) sessions.delete(sessionId);
  res.json({ success: true });
});

// ========== 监控路由 ==========

// 获取所有实例状态
app.get('/api/instances', requireAuth, async (req, res) => {
  await Promise.all(instances.map(inst => checkInstance(inst)));
  res.json(instances.map(({ id, name, url, status, error, lastSeen, metrics }) => ({ id, name, url, status, error, lastSeen, metrics })));
});

// 添加实例
app.post('/api/instances', requireAuth, async (req, res) => {
  const { id, name, url, token } = req.body;
  if (!id || !url) return res.status(400).json({ error: '实例 ID 和 WebSocket 地址是必填项' });
  
  if (instances.find(i => i.id === id)) return res.status(400).json({ error: '实例已存在' });

  const instance: MonitoredInstance = { id, name: name || id, url, token: token || '', status: 'offline', reconnectAttempts: 0 };
  await checkInstance(instance);
  instances.push(instance);
  await saveInstances();
  res.json(instance);
});

// 删除实例
app.delete('/api/instances/:id', requireAuth, async (req, res) => {
  const index = instances.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '实例不存在' });
  
  if (instances[index].ws) instances[index].ws.close();
  instances.splice(index, 1);
  await saveInstances();
  res.json({ success: true });
});

// 刷新单个实例状态
app.get('/api/instances/:id/status', requireAuth, async (req, res) => {
  const instance = instances.find(i => i.id === req.params.id);
  if (!instance) return res.status(404).json({ error: '实例不存在' });
  await checkInstance(instance);
  res.json({ id: instance.id, name: instance.name, url: instance.url, status: instance.status, error: instance.error, lastSeen: instance.lastSeen, metrics: instance.metrics });
});

// 获取错误日志
app.get('/api/errors', requireAuth, async (req, res) => {
  const resolved = req.query.resolved === 'true';
  const filtered = errorLogs.filter(e => e.resolved === resolved);
  res.json(filtered);
});

// 标记错误为已解决
app.post('/api/errors/:id/resolve', requireAuth, async (req, res) => {
  const error = errorLogs.find(e => e.id === req.params.id);
  if (!error) return res.status(404).json({ error: '错误记录不存在' });
  error.resolved = true;
  await saveErrors();
  res.json({ success: true });
});

// 获取版本信息
app.get('/api/version', requireAuth, async (req, res) => {
  const release = await getLatestRelease();
  res.json({ current: 'N/A (远程监控)', latest: release, updateAvailable: release.version !== '获取失败' });
});

// 获取官方链接
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
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../../frontend/dist/index.html')); });

// ========== 启动 ==========

async function start() {
  await loadData();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🦞 OpenClaw Monitor 已启动');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 端口：${PORT}`);
    console.log(`🌐 公网：https://3001-organic-spoon-xjprjrg46wq3v6xw.app.github.dev`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (config.enableAdminLogin) {
      console.log('🔐 管理员登录已启用');
    } else {
      console.log('🔓 管理员登录未启用（无需登录即可访问）');
    }
    console.log('');
  });
  
  // 每 30 秒自动检查所有实例
  setInterval(async () => {
    await Promise.all(instances.map(inst => checkInstance(inst)));
  }, 30000);
}

start();

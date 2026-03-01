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

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, '../config.json');
const DEFAULT_CONFIG = {
  enableAdminLogin: false,
  adminUser: '',
  adminPass: '',
  allowRegister: false
};

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
  return DEFAULT_CONFIG;
}

let config = loadConfig();

app.use(cors());
app.use(express.json());

// 数据文件
const DATA_FILE = path.join(__dirname, '../data.json');

// 会话存储
const sessions: Map<string, { username: string; loginAt: number }> = new Map();

// 数据加载/保存
interface UserData {
  username: string;
  passwordHash: string;
  createdAt: number;
}

interface AppData {
  user: UserData | null;
}

let appData: AppData = { user: null };

async function loadData() {
  try {
    const { stdout } = await execAsync(`cat ${DATA_FILE} 2>/dev/null || echo '{}'`);
    appData = JSON.parse(stdout.trim() || '{}');
    if (!appData.user) appData = { user: null };
    console.log('📦 数据已加载');
  } catch (err) {
    appData = { user: null };
  }
}

async function saveData() {
  try {
    await execAsync(`echo '${JSON.stringify(appData, null, 2)}' > ${DATA_FILE}`);
  } catch (err) { console.error('Failed to save data:', err); }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ========== 实例配置 ==========

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
}

const instances: MonitoredInstance[] = [];
const INSTANCES_FILE = path.join(__dirname, '../instances.json');

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

async function getLatestRelease() {
  try {
    const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'OpenClaw-Monitor/1.0' };
    const response = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest', { headers });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data: any = await response.json();
    return { version: data.tag_name || 'unknown', publishedAt: data.published_at, body: data.body || '', url: data.html_url };
  } catch (err: any) {
    return { version: '获取失败', publishedAt: null, body: err.message, url: 'https://github.com/openclaw/openclaw/releases' };
  }
}

// ========== 认证中间件 ==========

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  // 如果未启用管理员登录，直接放行
  if (!config.enableAdminLogin) {
    return next();
  }
  
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
  
  // 检查是否已登录
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    if (Date.now() - session.loginAt < 24 * 60 * 60 * 1000) {
      return res.json({ 
        hasUser: true, 
        authenticated: true, 
        username: session.username,
        enableAdminLogin: config.enableAdminLogin
      });
    }
    sessions.delete(sessionId);
  }
  
  // 返回登录状态
  res.json({ 
    hasUser: config.enableAdminLogin && config.adminUser && config.adminPass,
    authenticated: false, 
    allowRegister: false,
    enableAdminLogin: config.enableAdminLogin
  });
});

app.post('/api/auth/register', async (req, res) => {
  res.status(403).json({ error: '注册已关闭' });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // 检查是否启用了管理员登录
  if (!config.enableAdminLogin) {
    return res.status(403).json({ error: '管理员登录未启用，请在 config.json 中设置 enableAdminLogin: true' });
  }
  
  // 使用配置文件中的账号
  if (config.adminUser && config.adminPass) {
    if (username !== config.adminUser || hashPassword(password) !== config.adminPass) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { username, loginAt: Date.now() });
    return res.json({ success: true, sessionId, username });
  }
  
  return res.status(400).json({ error: '请先在 config.json 中配置管理员账号' });
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
      return res.json({ authenticated: true, username: session.username });
    }
    sessions.delete(sessionId);
  }
  res.json({ authenticated: false });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  // 如果使用配置文件，不允许在线修改密码
  if (config.enableAdminLogin && config.adminUser && config.adminPass) {
    return res.status(403).json({ error: '配置文件模式下，请直接在 config.json 中修改密码' });
  }
  
  if (!appData.user) {
    return res.status(400).json({ error: '用户不存在' });
  }
  
  const oldPasswordHash = hashPassword(oldPassword);
  if (oldPasswordHash !== appData.user.passwordHash) {
    return res.status(401).json({ error: '原密码错误' });
  }
  
  appData.user.passwordHash = hashPassword(newPassword);
  await saveData();
  
  res.json({ success: true });
});

// ========== API 路由 ==========

app.get('/api/instances', requireAuth, async (req, res) => {
  await Promise.all(instances.map(inst => checkInstance(inst)));
  res.json(instances.map(i => ({ id: i.id, name: i.name, url: i.url, status: i.status, error: i.error, lastSeen: i.lastSeen })));
});

app.post('/api/instances', requireAuth, async (req, res) => {
  const { id, name, url, token } = req.body;
  if (!id || !url) return res.status(400).json({ error: '实例 ID 和 WebSocket 地址是必填项' });
  
  const existing = instances.find(i => i.id === id);
  if (existing) return res.status(400).json({ error: '实例已存在' });

  const instance: MonitoredInstance = { id, name: name || id, url, token: token || '', status: 'offline', reconnectAttempts: 0 };
  await checkInstance(instance);
  instances.push(instance);
  await saveInstances();
  res.json(instance);
});

app.delete('/api/instances/:id', requireAuth, async (req, res) => {
  const index = instances.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '实例不存在' });
  
  const instance = instances[index];
  if (instance.ws) instance.ws.close();
  
  instances.splice(index, 1);
  await saveInstances();
  res.json({ success: true });
});

app.get('/api/instances/:id/status', requireAuth, async (req, res) => {
  const instance = instances.find(i => i.id === req.params.id);
  if (!instance) return res.status(404).json({ error: '实例不存在' });
  await checkInstance(instance);
  res.json({ id: instance.id, name: instance.name, url: instance.url, status: instance.status, error: instance.error, lastSeen: instance.lastSeen });
});

app.get('/api/version/latest', requireAuth, async (req, res) => {
  const release = await getLatestRelease();
  res.json({ current: 'N/A (远程监控)', latest: release, updateAvailable: release.version !== '获取失败' });
});

app.get('/api/logs', requireAuth, async (req, res) => {
  res.json({ logs: '-- 日志功能需要实例支持 --\n\n提示：可以在各 OpenClaw 实例上查看本地日志' });
});

app.get('/api/links', requireAuth, (req, res) => {
  res.json({ github: 'https://github.com/openclaw/openclaw', releases: 'https://github.com/openclaw/openclaw/releases', docs: 'https://docs.openclaw.ai', discord: 'https://discord.com/invite/clawd', clawhub: 'https://clawhub.com' });
});

// ========== 静态文件服务 ==========

app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, '../../frontend/dist/index.html')); });

// ========== 启动 ==========

async function start() {
  await loadData();
  await loadInstances();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🦞 OpenClaw 监控面板 已启动');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 端口：${PORT}`);
    console.log(`🌐 公网：https://3001-organic-spoon-xjprjrg46wq3v6xw.app.github.dev`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (config.enableAdminLogin) {
      console.log('🔐 管理员登录已启用');
      if (config.adminUser && config.adminPass) {
        console.log('✅ 管理员账号已配置');
      } else {
        console.log('⚠️  警告：未配置 adminUser 和 adminPass');
      }
    } else {
      console.log('🔓 管理员登录未启用（无需登录即可访问）');
      console.log('💡 如需启用，请编辑 config.json：{ "enableAdminLogin": true }');
    }
    console.log('');
  });
  
  setInterval(async () => { await Promise.all(instances.map(inst => checkInstance(inst))); }, 30000);
}

start();

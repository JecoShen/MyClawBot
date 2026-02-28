import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import osUtils from 'os-utils';
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use(cors());
app.use(express.json());
// ========== 配置 ==========
// 本地 OpenClaw Gateway 配置
const LOCAL_GATEWAY = {
    url: process.env.OPENCLAW_LOCAL_URL || 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN || ''
};
const remoteInstances = [];
// 持久化存储路径
const INSTANCES_FILE = path.join(__dirname, '../instances.json');
// ========== 工具函数 ==========
async function saveInstances() {
    try {
        const data = remoteInstances.map(i => ({
            id: i.id,
            name: i.name,
            url: i.url,
            token: i.token
        }));
        await execAsync(`echo '${JSON.stringify(data, null, 2)}' > ${INSTANCES_FILE}`);
    }
    catch (err) {
        console.error('Failed to save instances:', err);
    }
}
async function loadInstances() {
    try {
        const { stdout } = await execAsync(`cat ${INSTANCES_FILE} 2>/dev/null || echo '[]'`);
        const data = JSON.parse(stdout.trim() || '[]');
        data.forEach((d) => {
            remoteInstances.push({
                ...d,
                status: 'offline',
                reconnectAttempts: 0
            });
        });
        console.log(`Loaded ${remoteInstances.length} remote instances`);
    }
    catch (err) {
        console.error('Failed to load instances:', err);
    }
}
async function getSystemInfo() {
    try {
        const [cpuUsage, mem, disk, uptime] = await Promise.all([
            new Promise((resolve) => osUtils.cpuUsage(resolve)),
            execAsync("free -m 2>/dev/null || echo '0 0 0 0'"),
            execAsync("df -h / 2>/dev/null | tail -1 || echo '0 0 0 0'"),
            execAsync("uptime -p 2>/dev/null || uptime || echo 'unknown'")
        ]);
        const memLines = mem.stdout.trim().split('\n');
        const memInfo = memLines[1] ? memLines[1].split(/\s+/) : ['0', '0', '0'];
        const diskLines = disk.stdout.trim().split('\n');
        const diskInfo = diskLines[0] ? diskLines[0].split(/\s+/) : ['0', '0', '0'];
        return {
            cpu: {
                cores: os.cpus().length,
                usage: Math.round(cpuUsage * 100)
            },
            memory: {
                total: parseInt(memInfo[1]) || 0,
                used: parseInt(memInfo[2]) || 0,
                free: parseInt(memInfo[3]) || 0,
                percent: memInfo[2] && memInfo[1] ? Math.round((parseInt(memInfo[2]) / parseInt(memInfo[1])) * 100) : 0
            },
            disk: {
                total: diskInfo[1] || '0',
                used: diskInfo[2] || '0',
                free: diskInfo[3] || '0',
                percent: parseInt(diskInfo[4]?.replace('%', '')) || 0
            },
            uptime: uptime.stdout.trim()
        };
    }
    catch (error) {
        console.error('Failed to get system info:', error);
        return {
            cpu: { cores: 0, usage: 0 },
            memory: { total: 0, used: 0, free: 0, percent: 0 },
            disk: { total: '0', used: '0', free: '0', percent: 0 },
            uptime: 'unknown'
        };
    }
}
async function getOpenClawVersion() {
    try {
        const { stdout } = await execAsync('openclaw --version 2>&1 || echo "not installed"', {
            cwd: '/home/codespace/.openclaw/workspace'
        });
        return stdout.trim();
    }
    catch {
        return 'not installed';
    }
}
function connectGateway(instance) {
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
            instance.error = 'Connection timeout';
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
            instance.lastErrorTime = Date.now();
            resolve('error');
        });
        ws.on('close', () => {
            if (instance.status === 'online') {
                instance.status = 'offline';
                instance.error = 'Connection closed';
                instance.lastSeen = Date.now();
            }
        });
    });
}
async function getLatestRelease() {
    try {
        const headers = {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'OpenClaw-Monitor/1.0'
        };
        const githubToken = process.env.GITHUB_TOKEN;
        if (githubToken) {
            headers['Authorization'] = `Bearer ${githubToken}`;
        }
        const response = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest', { headers });
        if (!response.ok) {
            if (response.status === 403) {
                return {
                    version: 'Rate Limited',
                    publishedAt: null,
                    body: 'GitHub API 限流。设置 GITHUB_TOKEN 或访问:\nhttps://github.com/openclaw/openclaw/releases',
                    url: 'https://github.com/openclaw/openclaw/releases'
                };
            }
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        const fullBody = data.body || '';
        let simplifiedBody = fullBody;
        const changesMatch = fullBody.match(/### Changes[\s\S]*?(?=###|$)/i);
        const fixesMatch = fullBody.match(/### Fixes[\s\S]*?(?=###|$)/i);
        if (changesMatch || fixesMatch) {
            simplifiedBody = '';
            if (changesMatch)
                simplifiedBody += changesMatch[0].trim() + '\n\n';
            if (fixesMatch)
                simplifiedBody += fixesMatch[0].trim();
            simplifiedBody = simplifiedBody.trim();
        }
        return {
            version: data.tag_name || 'unknown',
            publishedAt: data.published_at,
            body: simplifiedBody || fullBody,
            url: data.html_url
        };
    }
    catch (err) {
        console.error('Failed to fetch release:', err.message);
        return {
            version: 'Fetch Failed',
            publishedAt: null,
            body: `错误：${err.message}\n\n访问：https://github.com/openclaw/openclaw/releases`,
            url: 'https://github.com/openclaw/openclaw/releases'
        };
    }
}
// ========== API 路由（必须在静态文件服务之前）==========
app.get('/api/status/all', async (req, res) => {
    const [systemInfo, version, localGateway] = await Promise.all([
        getSystemInfo(),
        getOpenClawVersion(),
        connectGateway({
            id: 'local',
            name: 'Local',
            url: LOCAL_GATEWAY.url,
            token: LOCAL_GATEWAY.token,
            status: 'offline',
            reconnectAttempts: 0
        })
    ]);
    await Promise.all(remoteInstances.map(inst => connectGateway(inst)));
    res.json({
        local: {
            instance: 'local',
            name: process.env.INSTANCE_NAME || 'GitHub Codespaces',
            status: localGateway,
            version,
            system: systemInfo,
            lastSeen: Date.now()
        },
        remote: remoteInstances.map(i => ({
            id: i.id,
            name: i.name,
            url: i.url,
            status: i.status,
            error: i.error,
            lastSeen: i.lastSeen
        }))
    });
});
app.get('/api/instances', (req, res) => {
    res.json(remoteInstances.map(i => ({
        id: i.id,
        name: i.name,
        url: i.url,
        status: i.status,
        error: i.error,
        lastSeen: i.lastSeen
    })));
});
app.post('/api/instances', async (req, res) => {
    const { id, name, url, token } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'id 和 url 是必填项' });
    }
    const existing = remoteInstances.find(i => i.id === id);
    if (existing) {
        return res.status(400).json({ error: '实例已存在' });
    }
    const instance = {
        id,
        name: name || id,
        url,
        token: token || '',
        status: 'offline',
        reconnectAttempts: 0
    };
    await connectGateway(instance);
    remoteInstances.push(instance);
    await saveInstances();
    res.json(instance);
});
app.delete('/api/instances/:id', async (req, res) => {
    const index = remoteInstances.findIndex(i => i.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: '实例不存在' });
    }
    const instance = remoteInstances[index];
    if (instance.ws) {
        instance.ws.close();
    }
    remoteInstances.splice(index, 1);
    await saveInstances();
    res.json({ success: true });
});
app.get('/api/instances/:id/status', async (req, res) => {
    const instance = remoteInstances.find(i => i.id === req.params.id);
    if (!instance) {
        return res.status(404).json({ error: '实例不存在' });
    }
    await connectGateway(instance);
    res.json({
        id: instance.id,
        name: instance.name,
        url: instance.url,
        status: instance.status,
        error: instance.error,
        lastSeen: instance.lastSeen
    });
});
app.get('/api/version/latest', async (req, res) => {
    const [release, currentVersion] = await Promise.all([
        getLatestRelease(),
        getOpenClawVersion()
    ]);
    res.json({
        current: currentVersion,
        latest: release,
        updateAvailable: release.version !== 'Fetch Failed' && release.version !== 'Rate Limited' && !currentVersion.includes(release.version)
    });
});
app.get('/api/logs', async (req, res) => {
    try {
        const { stdout } = await execAsync('journalctl -u openclaw-gateway -n 100 --no-pager 2>/dev/null || openclaw gateway status 2>&1 || echo "日志不可用"', {
            cwd: '/home/codespace/.openclaw/workspace'
        });
        res.json({ logs: stdout });
    }
    catch (err) {
        res.json({ logs: err.message || '无法获取日志' });
    }
});
app.post('/api/gateway/restart', async (req, res) => {
    try {
        await execAsync('openclaw gateway restart 2>&1', {
            cwd: '/home/codespace/.openclaw/workspace'
        });
        res.json({ success: true, message: 'Gateway 重启中...' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/update', async (req, res) => {
    try {
        const { stdout } = await execAsync('openclaw update run 2>&1', {
            cwd: '/home/codespace/.openclaw/workspace'
        });
        res.json({ success: true, output: stdout });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/links', (req, res) => {
    res.json({
        github: 'https://github.com/openclaw/openclaw',
        releases: 'https://github.com/openclaw/openclaw/releases',
        docs: 'https://docs.openclaw.ai',
        discord: 'https://discord.com/invite/clawd',
        clawhub: 'https://clawhub.com'
    });
});
// ========== 静态文件服务（必须在 API 路由之后）==========
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
// ========== 启动 ==========
async function start() {
    await loadInstances();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🦞 OpenClaw Monitor Backend 运行在端口 ${PORT}`);
        console.log(`   本地：http://localhost:${PORT}`);
        console.log(`   公网：https://organic-spoon-xjprjrg46wq3v6xw-${PORT}.app.github.dev`);
    });
    setInterval(async () => {
        console.log('🔄 自动检查实例状态...');
        await Promise.all(remoteInstances.map(inst => connectGateway(inst)));
    }, 30000);
}
start();
//# sourceMappingURL=index.js.map
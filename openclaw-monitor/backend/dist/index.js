import express from 'express';
import cors from 'cors';
import { WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use(cors());
app.use(express.json());
// 静态文件服务（前端构建后）
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
// 本地 OpenClaw Gateway 配置
const LOCAL_GATEWAY = {
    url: 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN || ''
};
const remoteInstances = [];
// 获取系统资源信息
async function getSystemInfo() {
    try {
        const [cpu, mem, disk, uptime] = await Promise.all([
            execAsync("grep -c ^processor /proc/cpuinfo 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo '0'"),
            execAsync("free -m 2>/dev/null || sysctl -n hw.memsize 2>/dev/null || echo '0 0'"),
            execAsync("df -h / 2>/dev/null | tail -1 || echo '0 0 0'"),
            execAsync("uptime -p 2>/dev/null || uptime || echo '0'")
        ]);
        const memLines = mem.stdout.trim().split('\n');
        const memInfo = memLines[1] ? memLines[1].split(/\s+/) : ['0', '0', '0'];
        const diskLines = disk.stdout.trim().split('\n');
        const diskInfo = diskLines[0] ? diskLines[0].split(/\s+/) : ['0', '0', '0'];
        return {
            cpu: {
                cores: parseInt(cpu.stdout.trim()) || 0,
                usage: 0 // 需要更复杂的计算
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
        return {
            cpu: { cores: 0, usage: 0 },
            memory: { total: 0, used: 0, free: 0, percent: 0 },
            disk: { total: '0', used: '0', free: '0', percent: 0 },
            uptime: 'unknown'
        };
    }
}
// 获取 OpenClaw 版本
async function getOpenClawVersion() {
    try {
        const { stdout } = await execAsync('openclaw --version 2>&1 || echo "unknown"');
        return stdout.trim();
    }
    catch {
        return 'unknown';
    }
}
// 获取 Gateway 状态
async function getGatewayStatus() {
    return new Promise((resolve) => {
        const ws = new WebSocket(LOCAL_GATEWAY.url, {
            headers: LOCAL_GATEWAY.token ? { 'Authorization': `Bearer ${LOCAL_GATEWAY.token}` } : {}
        });
        const timeout = setTimeout(() => {
            ws.close();
            resolve({ status: 'offline', error: 'Connection timeout' });
        }, 5000);
        ws.on('open', () => {
            clearTimeout(timeout);
            ws.close();
            resolve({ status: 'online' });
        });
        ws.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ status: 'offline', error: err.message });
        });
    });
}
// 获取 GitHub 最新版本和更新日志
async function getLatestRelease() {
    try {
        const response = await fetch('https://api.github.com/repos/openclaw/openclaw/releases/latest');
        const data = await response.json();
        return {
            version: data.tag_name || 'unknown',
            publishedAt: data.published_at,
            body: data.body || '',
            url: data.html_url
        };
    }
    catch {
        return null;
    }
}
// API 路由
// 获取本地实例状态
app.get('/api/status/local', async (req, res) => {
    const [systemInfo, version, gatewayStatus] = await Promise.all([
        getSystemInfo(),
        getOpenClawVersion(),
        getGatewayStatus()
    ]);
    const status = gatewayStatus;
    res.json({
        instance: 'local',
        name: 'GitHub Codespaces',
        status: status.status,
        version,
        system: systemInfo,
        lastSeen: Date.now()
    });
});
// 获取远程实例列表
app.get('/api/instances', (req, res) => {
    res.json(remoteInstances);
});
// 添加远程实例
app.post('/api/instances', (req, res) => {
    const { id, name, url, token } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'id and url are required' });
    }
    const existing = remoteInstances.find(i => i.id === id);
    if (existing) {
        return res.status(400).json({ error: 'Instance already exists' });
    }
    const instance = {
        id,
        name: name || id,
        url,
        token: token || '',
        status: 'offline'
    };
    remoteInstances.push(instance);
    res.json(instance);
});
// 删除远程实例
app.delete('/api/instances/:id', (req, res) => {
    const index = remoteInstances.findIndex(i => i.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    remoteInstances.splice(index, 1);
    res.json({ success: true });
});
// 检查远程实例状态
app.get('/api/instances/:id/status', async (req, res) => {
    const instance = remoteInstances.find(i => i.id === req.params.id);
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    try {
        const ws = new WebSocket(instance.url, {
            headers: instance.token ? { 'Authorization': `Bearer ${instance.token}` } : {}
        });
        const timeout = setTimeout(() => {
            ws.close();
            instance.status = 'offline';
            instance.error = 'Connection timeout';
            instance.lastSeen = Date.now();
            res.json(instance);
        }, 5000);
        ws.on('open', () => {
            clearTimeout(timeout);
            ws.close();
            instance.status = 'online';
            instance.error = undefined;
            instance.lastSeen = Date.now();
            res.json(instance);
        });
        ws.on('error', (err) => {
            clearTimeout(timeout);
            instance.status = 'error';
            instance.error = err.message;
            instance.lastSeen = Date.now();
            res.json(instance);
        });
    }
    catch (err) {
        instance.status = 'error';
        instance.error = err.message;
        instance.lastSeen = Date.now();
        res.json(instance);
    }
});
// 获取最新版本信息
app.get('/api/version/latest', async (req, res) => {
    const release = await getLatestRelease();
    const currentVersion = await getOpenClawVersion();
    res.json({
        current: currentVersion,
        latest: release,
        updateAvailable: release && !currentVersion.includes(release.version)
    });
});
// 获取 Gateway 日志（最近 100 行）
app.get('/api/logs', async (req, res) => {
    try {
        const { stdout } = await execAsync('journalctl -u openclaw-gateway -n 100 --no-pager 2>/dev/null || echo "Logs not available via journalctl"');
        res.json({ logs: stdout });
    }
    catch (err) {
        res.json({ logs: err.message || 'Unable to fetch logs' });
    }
});
// 获取会话列表
app.get('/api/sessions', async (req, res) => {
    try {
        const { stdout } = await execAsync('openclaw sessions list --json 2>&1');
        const sessions = JSON.parse(stdout);
        res.json(sessions);
    }
    catch (err) {
        res.json({ error: err.message, sessions: [] });
    }
});
// 重启 Gateway
app.post('/api/gateway/restart', async (req, res) => {
    try {
        await execAsync('openclaw gateway restart 2>&1');
        res.json({ success: true, message: 'Gateway restart initiated' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 更新 OpenClaw
app.post('/api/update', async (req, res) => {
    try {
        const { stdout } = await execAsync('openclaw update run 2>&1');
        res.json({ success: true, output: stdout });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🦞 OpenClaw Monitor Backend running on port ${PORT}`);
    console.log(`   Local: http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map
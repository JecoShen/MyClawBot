import { useState, useEffect } from 'react'

interface SystemInfo {
  cpu: { cores: number; usage: number }
  memory: { total: number; used: number; free: number; percent: number }
  disk: { total: string; used: string; free: string; percent: number }
  uptime: string
}

interface LocalStatus {
  instance: string
  name: string
  status: 'online' | 'offline' | 'error'
  version: string
  system: SystemInfo
  lastSeen: number
}

interface VersionInfo {
  current: string
  latest: {
    version: string
    publishedAt: string
    body: string
    bodyZh?: string
    url: string
  } | null
  updateAvailable: boolean
}

interface LogData {
  logs: string
}

interface RemoteInstance {
  id: string
  name: string
  url: string
  token?: string
  status: 'online' | 'offline' | 'error'
  error?: string
  lastSeen?: number
}

interface NewInstanceForm {
  id: string
  name: string
  url: string
  token: string
}

function App() {
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'logs' | 'update'>('overview')
  const [instances, setInstances] = useState<RemoteInstance[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newInstance, setNewInstance] = useState<NewInstanceForm>({ id: '', name: '', url: '', token: '' })

  // 获取实例列表
  const fetchInstances = async () => {
    try {
      const res = await fetch('/api/instances')
      const data = await res.json()
      setInstances(data)
    } catch (err) {
      console.error('Failed to fetch instances:', err)
    }
  }

  const fetchData = async () => {
    try {
      const [statusRes, versionRes, logsRes] = await Promise.all([
        fetch('/api/status/local'),
        fetch('/api/version/latest'),
        fetch('/api/logs')
      ])
      
      const status = await statusRes.json()
      const version = await versionRes.json()
      const logsData = await logsRes.json() as LogData
      
      setLocalStatus(status)
      setVersionInfo(version)
      setLogs(logsData.logs)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      setLoading(false)
    }
    fetchInstances() // 同时获取实例列表
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // 30 秒刷新
    return () => clearInterval(interval)
  }, [])

  // 添加实例
  const handleAddInstance = async () => {
    if (!newInstance.id || !newInstance.url) {
      alert('ID 和 WebSocket 地址是必填项')
      return
    }
    try {
      await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInstance)
      })
      setNewInstance({ id: '', name: '', url: '', token: '' })
      setShowAddForm(false)
      fetchInstances()
      alert('实例添加成功')
    } catch (err) {
      alert('添加失败：' + err)
    }
  }

  // 删除实例
  const handleDeleteInstance = async (id: string) => {
    if (!confirm(`确定要删除实例 "${id}" 吗？`)) return
    try {
      await fetch(`/api/instances/${id}`, { method: 'DELETE' })
      fetchInstances()
      alert('实例已删除')
    } catch (err) {
      alert('删除失败：' + err)
    }
  }

  // 刷新实例状态
  const handleRefreshInstance = async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/status`)
      const updated = await res.json()
      setInstances(prev => prev.map(i => i.id === id ? updated : i))
    } catch (err) {
      alert('刷新失败：' + err)
    }
  }

  const handleRestart = async () => {
    if (!confirm('确定要重启 Gateway 吗？')) return
    try {
      await fetch('/api/gateway/restart', { method: 'POST' })
      alert('Gateway 重启中...')
    } catch (err) {
      alert('重启失败：' + err)
    }
  }

  const handleUpdate = async () => {
    if (!confirm('确定要更新 OpenClaw 吗？')) return
    try {
      const res = await fetch('/api/update', { method: 'POST' })
      const data = await res.json()
      alert('更新输出：\n' + data.output)
    } catch (err) {
      alert('更新失败：' + err)
    }
  }

  const copyLogs = () => {
    navigator.clipboard.writeText(logs)
    alert('日志已复制到剪贴板')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl">🦞 加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🦞</span>
              <div>
                <h1 className="text-xl font-bold">OpenClaw 监控面板</h1>
                <p className="text-sm text-gray-400">GitHub Codespaces 实例</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                localStatus?.status === 'online' 
                  ? 'bg-green-900 text-green-300' 
                  : 'bg-red-900 text-red-300'
              }`}>
                {localStatus?.status === 'online' ? '● 运行中' : '● 已离线'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            概览
          </button>
          <button
            onClick={() => setActiveTab('instances')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'instances'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            实例管理
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'logs'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            日志
          </button>
          <button
            onClick={() => setActiveTab('update')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'update'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            更新
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 版本卡片 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-2">当前版本</h3>
              <p className="text-2xl font-mono">{localStatus?.version || '未知'}</p>
              {versionInfo?.updateAvailable && (
                <span className="text-xs text-yellow-400 mt-2 block">
                  有新版本可用：{versionInfo.latest?.version}
                </span>
              )}
            </div>

            {/* CPU 卡片 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-2">CPU</h3>
              <p className="text-2xl font-bold">{localStatus?.system.cpu.cores} 核心</p>
              <p className="text-sm text-gray-400 mt-1">使用率：{localStatus?.system.cpu.usage}%</p>
            </div>

            {/* 内存卡片 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-2">内存</h3>
              <p className="text-2xl font-bold">{localStatus?.system.memory.percent}%</p>
              <p className="text-sm text-gray-400 mt-1">
                {localStatus?.system.memory.used}MB / {localStatus?.system.memory.total}MB
              </p>
              <div className="mt-2 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${localStatus?.system.memory.percent || 0}%` }}
                />
              </div>
            </div>

            {/* 磁盘卡片 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-2">磁盘</h3>
              <p className="text-2xl font-bold">{localStatus?.system.disk.percent}%</p>
              <p className="text-sm text-gray-400 mt-1">
                已用：{localStatus?.system.disk.used} / 总计：{localStatus?.system.disk.total}
              </p>
              <div className="mt-2 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${localStatus?.system.disk.percent || 0}%` }}
                />
              </div>
            </div>

            {/* 运行时间 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-2">运行时间</h3>
              <p className="text-xl">{localStatus?.system.uptime || '未知'}</p>
            </div>

            {/* 最后更新 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-2">最后更新</h3>
              <p className="text-xl">
                {localStatus?.lastSeen 
                  ? new Date(localStatus.lastSeen).toLocaleString('zh-CN')
                  : '未知'}
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-sm text-gray-400 mb-4">快速操作</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleRestart}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-medium transition-colors"
                >
                  重启 Gateway
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'instances' && (
          <div className="space-y-4">
            {/* 添加实例按钮 */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">远程 OpenClaw 实例</h3>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
              >
                {showAddForm ? '取消添加' : '+ 添加实例'}
              </button>
            </div>

            {/* 添加实例表单 */}
            {showAddForm && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h4 className="font-medium mb-4">添加新实例</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">实例 ID *</label>
                    <input
                      type="text"
                      value={newInstance.id}
                      onChange={(e) => setNewInstance({ ...newInstance, id: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      placeholder="例如：home-server"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">名称</label>
                    <input
                      type="text"
                      value={newInstance.name}
                      onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      placeholder="例如：家里服务器"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">WebSocket 地址 *</label>
                    <input
                      type="text"
                      value={newInstance.url}
                      onChange={(e) => setNewInstance({ ...newInstance, url: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      placeholder="例如：ws://192.168.1.100:18789"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Gateway Token（可选）</label>
                    <input
                      type="text"
                      value={newInstance.token}
                      onChange={(e) => setNewInstance({ ...newInstance, token: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                      placeholder="如果 Gateway 配置了认证则填写"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleAddInstance}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
                  >
                    确认添加
                  </button>
                </div>
              </div>
            )}

            {/* 实例列表 */}
            {instances.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center text-gray-400">
                暂无远程实例，点击上方按钮添加
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-bold">{instance.name || instance.id}</h4>
                        <p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        instance.status === 'online' 
                          ? 'bg-green-900 text-green-300' 
                          : instance.status === 'error'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {instance.status === 'online' ? '● 在线' : instance.status === 'error' ? '● 错误' : '● 离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-4 break-all">{instance.url}</p>
                    {instance.error && (
                      <p className="text-xs text-red-400 mb-4">{instance.error}</p>
                    )}
                    {instance.lastSeen && (
                      <p className="text-xs text-gray-500 mb-4">
                        最后检查：{new Date(instance.lastSeen).toLocaleString('zh-CN')}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRefreshInstance(instance.id)}
                        className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
                      >
                        刷新状态
                      </button>
                      <button
                        onClick={() => handleDeleteInstance(instance.id)}
                        className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-medium">Gateway 日志（最近 100 行）</h3>
              <button
                onClick={copyLogs}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
              >
                复制日志
              </button>
            </div>
            <pre className="p-4 text-sm font-mono text-gray-300 overflow-auto max-h-[600px]">
              {logs || '暂无日志'}
            </pre>
          </div>
        )}

        {activeTab === 'update' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">版本信息</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400">当前版本：</span>
                  <span className="font-mono ml-2">{versionInfo?.current}</span>
                </div>
                {versionInfo?.latest && (
                  <>
                    <div>
                      <span className="text-gray-400">最新版本：</span>
                      <span className="font-mono ml-2">{versionInfo.latest.version}</span>
                      {versionInfo.latest.publishedAt && (
                        <span className="text-gray-400 text-sm ml-2">
                          ({new Date(versionInfo.latest.publishedAt).toLocaleDateString('zh-CN')})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-400">更新可用：</span>
                      <span className={versionInfo.updateAvailable ? 'text-green-400' : 'text-gray-400'}>
                        {versionInfo.updateAvailable ? '是' : '否'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {versionInfo?.latest?.body && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-bold mb-4">更新日志</h3>
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-300">
                    {versionInfo.latest.bodyZh || versionInfo.latest.body}
                  </pre>
                </div>
              </div>
            )}

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4">操作</h3>
              <div className="flex gap-3">
                <button
                  onClick={handleUpdate}
                  disabled={!versionInfo?.updateAvailable}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    versionInfo?.updateAvailable
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                >
                  更新到最新版本
                </button>
                {versionInfo?.latest?.url && (
                  <a
                    href={versionInfo.latest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors inline-block"
                  >
                    查看 GitHub Release
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          OpenClaw 监控面板 · 每 30 秒自动刷新
        </div>
      </footer>
    </div>
  )
}

export default App

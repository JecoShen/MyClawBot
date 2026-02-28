import { useState, useEffect } from 'react'

interface RemoteInstance {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'error'
  error?: string
  lastSeen?: number
}

interface VersionInfo {
  current: string
  latest: { version: string; publishedAt: string; body: string; url: string } | null
  updateAvailable: boolean
}

interface OfficialLinks {
  github: string; releases: string; docs: string; discord: string; clawhub: string
}

interface NewInstanceForm {
  id: string; name: string; url: string; token: string
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem('sessionId') || '')
  const [instances, setInstances] = useState<RemoteInstance[]>([])
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [officialLinks, setOfficialLinks] = useState<OfficialLinks | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'logs' | 'update' | 'links'>('overview')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newInstance, setNewInstance] = useState<NewInstanceForm>({ id: '', name: '', url: '', token: '' })

  useEffect(() => {
    if (sessionId) {
      fetch('/api/auth/check', { headers: { 'X-Session-Id': sessionId } })
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            setAuthenticated(true)
            fetchData()
          } else {
            localStorage.removeItem('sessionId')
            setSessionId('')
            setAuthenticated(false)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const fetchData = async () => {
    if (!sessionId) return
    const headers = { 'X-Session-Id': sessionId }
    try {
      const [instancesRes, versionRes, logsRes, linksRes] = await Promise.all([
        fetch('/api/instances', { headers }),
        fetch('/api/version/latest', { headers }),
        fetch('/api/logs', { headers }),
        fetch('/api/links', { headers })
      ])
      setInstances(await instancesRes.json())
      setVersionInfo(await versionRes.json())
      setLogs((await logsRes.json()).logs)
      setOfficialLinks(await linksRes.json())
    } catch (err) { console.error('Failed to fetch data:', err) }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (res.ok) {
        setSessionId(data.sessionId)
        setAuthenticated(true)
        localStorage.setItem('sessionId', data.sessionId)
        fetchData()
      } else {
        setLoginError(data.error || '登录失败')
      }
    } catch (err) { setLoginError('网络错误，请稍后重试') }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { headers: { 'X-Session-Id': sessionId } })
    localStorage.removeItem('sessionId')
    setSessionId('')
    setAuthenticated(false)
    setInstances([])
  }

  const handleAddInstance = async () => {
    if (!newInstance.id || !newInstance.url) { alert('ID 和 WebSocket 地址是必填项'); return }
    try {
      await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify(newInstance)
      })
      setNewInstance({ id: '', name: '', url: '', token: '' })
      setShowAddForm(false)
      fetchData()
      alert('实例添加成功')
    } catch (err) { alert('添加失败：' + err) }
  }

  const handleDeleteInstance = async (id: string) => {
    if (!confirm(`确定要删除实例 "${id}" 吗？`)) return
    try {
      await fetch(`/api/instances/${id}`, { method: 'DELETE', headers: { 'X-Session-Id': sessionId } })
      fetchData()
      alert('实例已删除')
    } catch (err) { alert('删除失败：' + err) }
  }

  const handleRefreshInstance = async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/status`, { headers: { 'X-Session-Id': sessionId } })
      const updated = await res.json()
      setInstances(prev => prev.map(i => i.id === id ? updated : i))
    } catch (err) { alert('刷新失败：' + err) }
  }

  const handleUpdate = async () => {
    if (!confirm('确定要更新 OpenClaw 吗？')) return
    try {
      const res = await fetch('/api/update', { method: 'POST', headers: { 'X-Session-Id': sessionId } })
      const data = await res.json()
      alert('更新输出：\n' + data.output)
    } catch (err) { alert('更新失败：' + err) }
  }

  const copyLogs = () => { navigator.clipboard.writeText(logs); alert('日志已复制到剪贴板') }

  useEffect(() => {
    if (authenticated) {
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [authenticated, sessionId])

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-2xl">
            <div className="text-center mb-8">
              <span className="text-5xl mb-4 block">🦞</span>
              <h1 className="text-2xl font-bold text-white">OpenClaw 监控面板</h1>
              <p className="text-gray-400 mt-2">请登录以继续</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">用户名</label>
                <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500" placeholder="请输入用户名" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">密码</label>
                <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500" placeholder="请输入密码" required />
              </div>
              {loginError && <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{loginError}</div>}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors">登录</button>
            </form>
            <div className="mt-6 text-center text-sm text-gray-500">
              <p>默认账号：admin / admin123</p>
              <p className="mt-1 text-xs">可通过环境变量 ADMIN_USER 和 ADMIN_PASS 修改</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-xl animate-pulse">🦞 加载中...</div></div>

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🦞</span>
              <div><h1 className="text-xl font-bold">OpenClaw 监控面板</h1><p className="text-sm text-gray-400">多实例监控</p></div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">👤 已登录</span>
              <button onClick={handleLogout} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">退出登录</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex gap-2 border-b border-gray-700 overflow-x-auto">
          {['overview', 'instances', 'logs', 'update', 'links'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}>
              {tab === 'overview' && '📊 概览'}{tab === 'instances' && '💻 实例'}{tab === 'logs' && '📋 日志'}{tab === 'update' && '🔄 更新'}{tab === 'links' && '🔗 官方'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {instances.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 border border-gray-700 text-center">
                <span className="text-6xl mb-4 block">🌍</span>
                <h3 className="text-xl font-bold mb-2">暂无监控实例</h3>
                <p className="text-gray-400 mb-6">添加您的 OpenClaw 实例开始监控</p>
                <button onClick={() => { setActiveTab('instances'); setShowAddForm(true) }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">➕ 添加第一个实例</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
                    <div className="flex items-start justify-between mb-4">
                      <div><h4 className="font-bold text-lg">{instance.name || instance.id}</h4><p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p></div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${instance.status === 'online' ? 'bg-green-900/50 text-green-300 border border-green-700' : instance.status === 'error' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
                        {instance.status === 'online' ? '● 在线' : instance.status === 'error' ? '⚠ 错误' : '○ 离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-4 break-all bg-gray-900/50 rounded p-2">{instance.url}</p>
                    {instance.error && <p className="text-xs text-red-400 mb-4 bg-red-900/20 rounded p-2">{instance.error}</p>}
                    {instance.lastSeen && <p className="text-xs text-gray-500 mb-4">最后检查：{new Date(instance.lastSeen).toLocaleString('zh-CN')}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleRefreshInstance(instance.id)} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors">🔄 刷新</button>
                      <button onClick={() => handleDeleteInstance(instance.id)} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors">🗑️ 删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'instances' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2"><span>💻</span> OpenClaw 实例</h3>
              <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">{showAddForm ? '✕ 取消' : '+ 添加实例'}</button>
            </div>
            {showAddForm && (
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
                <h4 className="font-medium mb-4 flex items-center gap-2"><span>➕</span> 添加新实例</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-400 mb-1">实例 ID *</label><input type="text" value={newInstance.id} onChange={(e) => setNewInstance({ ...newInstance, id: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" placeholder="例如：home-server" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">名称</label><input type="text" value={newInstance.name} onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" placeholder="例如：家里服务器" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">WebSocket 地址 *</label><input type="text" value={newInstance.url} onChange={(e) => setNewInstance({ ...newInstance, url: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" placeholder="例如：ws://192.168.1.100:18789" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">Gateway Token（可选）</label><input type="text" value={newInstance.token} onChange={(e) => setNewInstance({ ...newInstance, token: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500" placeholder="如果 Gateway 配置了认证则填写" /></div>
                </div>
                <button onClick={handleAddInstance} className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors">确认添加</button>
              </div>
            )}
            {instances.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 border border-gray-700 text-center"><span className="text-4xl mb-4 block">🌍</span><p className="text-gray-400">暂无远程实例</p><p className="text-sm text-gray-500 mt-2">点击上方按钮添加 OpenClaw 实例</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
                    <div className="flex items-start justify-between mb-4">
                      <div><h4 className="font-bold text-lg">{instance.name || instance.id}</h4><p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p></div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${instance.status === 'online' ? 'bg-green-900/50 text-green-300 border border-green-700' : instance.status === 'error' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
                        {instance.status === 'online' ? '● 在线' : instance.status === 'error' ? '⚠ 错误' : '○ 离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-4 break-all bg-gray-900/50 rounded p-2">{instance.url}</p>
                    {instance.error && <p className="text-xs text-red-400 mb-4 bg-red-900/20 rounded p-2">{instance.error}</p>}
                    {instance.lastSeen && <p className="text-xs text-gray-500 mb-4">最后检查：{new Date(instance.lastSeen).toLocaleString('zh-CN')}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleRefreshInstance(instance.id)} className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors">🔄 刷新</button>
                      <button onClick={() => handleDeleteInstance(instance.id)} className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium transition-colors">🗑️ 删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 backdrop-blur">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-medium flex items-center gap-2"><span>📋</span> Gateway 日志（最近 200 行）</h3>
              <button onClick={copyLogs} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"><span>📋</span> 复制日志</button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-auto max-h-[600px] bg-gray-900/50 rounded-b-xl font-mono">{logs || '暂无日志'}</pre>
          </div>
        )}

        {activeTab === 'update' && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span>📦</span> 版本信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-700"><span className="text-gray-400">当前版本</span><span className="font-mono">{versionInfo?.current}</span></div>
                {versionInfo?.latest && (<>
                  <div className="flex justify-between py-2 border-b border-gray-700"><span className="text-gray-400">最新版本</span><span className="font-mono">{versionInfo.latest.version}{versionInfo.latest.publishedAt && <span className="text-gray-500 text-sm ml-2">({new Date(versionInfo.latest.publishedAt).toLocaleDateString('zh-CN')})</span>}</span></div>
                  <div className="flex justify-between py-2"><span className="text-gray-400">更新可用</span><span className={versionInfo.updateAvailable ? 'text-green-400' : 'text-gray-400'}>{versionInfo.updateAvailable ? '✅ 是' : '❌ 否'}</span></div>
                </>)}
              </div>
            </div>
            {versionInfo?.latest?.body && (
              <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span>📝</span> 更新日志</h3>
                <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono bg-gray-900/50 rounded p-4">{versionInfo.latest.body}</pre>
              </div>
            )}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span>🎮</span> 操作</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleUpdate} disabled={!versionInfo?.updateAvailable} className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${versionInfo?.updateAvailable ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'}`}><span>⬆️</span> 更新到最新版本</button>
                {versionInfo?.latest?.url && (<a href={versionInfo.latest.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors inline-flex items-center gap-2"><span>📄</span> 查看 GitHub Release</a>)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'links' && officialLinks && (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 backdrop-blur">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><span>🔗</span> OpenClaw 官方链接</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a href={officialLinks.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"><span className="text-2xl">📂</span><div><p className="font-medium">GitHub 仓库</p><p className="text-xs text-gray-400">源代码 & Issues</p></div></a>
                <a href={officialLinks.releases} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"><span className="text-2xl">🏷️</span><div><p className="font-medium">Releases</p><p className="text-xs text-gray-400">版本发布 & 更新日志</p></div></a>
                <a href={officialLinks.docs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"><span className="text-2xl">📖</span><div><p className="font-medium">官方文档</p><p className="text-xs text-gray-400">使用指南 & API</p></div></a>
                <a href={officialLinks.discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors"><span className="text-2xl">💬</span><div><p className="font-medium">Discord 社区</p><p className="text-xs text-gray-400">讨论 & 支持</p></div></a>
                <a href={officialLinks.clawhub} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors md:col-span-2"><span className="text-2xl">🦞</span><div><p className="font-medium">ClawHub</p><p className="text-xs text-gray-400">技能 & 扩展市场</p></div></a>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">🦞 OpenClaw 监控面板 · 每 30 秒自动刷新</div>
      </footer>
    </div>
  )
}

export default App

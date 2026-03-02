import { useState, useEffect } from 'react'

interface Instance {
  id: string
  name: string
  url: string
  status: 'online' | 'offline' | 'error'
  error?: string
  lastSeen?: number
  metrics?: { cpu?: number; memory?: number; disk?: number; uptime?: string }
}

interface ErrorLog {
  id: string
  instanceId: string
  instanceName: string
  level: 'error' | 'warning' | 'info'
  message: string
  context: string
  timestamp: number
  resolved: boolean
}

interface VersionInfo {
  current: string
  latest: { version: string; publishedAt: string; body: string; url: string } | null
  updateAvailable: boolean
}

function App() {
  const [authStatus, setAuthStatus] = useState<{ hasUser: boolean; authenticated: boolean; username?: string; enableAdminLogin?: boolean }>({ hasUser: false, authenticated: false })
  const [loading, setLoading] = useState(true)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [formError, setFormError] = useState('')
  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem('sessionId') || '')
  const [username, setUsername] = useState<string>(() => localStorage.getItem('username') || '')
  const [showMenu, setShowMenu] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'errors' | 'version'>('overview')
  const [instances, setInstances] = useState<Instance[]>([])
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([])
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newInstance, setNewInstance] = useState({ id: '', name: '', url: '', token: '' })

  // 主题切换
  useEffect(() => {
    document.body.classList.toggle('light-mode', !isDarkMode)
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  // 认证检查
  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status', { headers: sessionId ? { 'X-Session-Id': sessionId } : {} })
      const data = await res.json()
      setAuthStatus(data)
      if (!data.enableAdminLogin || (data.authenticated && sessionId)) fetchData()
      setLoading(false)
    } catch (err) { setLoading(false) }
  }

  const fetchData = async () => {
    if (!sessionId && authStatus.enableAdminLogin) return
    const headers: Record<string, string> = sessionId ? { 'X-Session-Id': sessionId } : {}
    try {
      const [instancesRes, errorsRes, versionRes] = await Promise.all([
        fetch('/api/instances', { headers }),
        fetch('/api/errors', { headers }),
        fetch('/api/version', { headers })
      ])
      setInstances(await instancesRes.json())
      setErrorLogs(await errorsRes.json())
      setVersionInfo(await versionRes.json())
    } catch (err) { console.error('Failed to fetch data:', err) }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await res.json()
      if (res.ok) {
        setSessionId(data.sessionId)
        setUsername(data.username)
        localStorage.setItem('sessionId', data.sessionId)
        localStorage.setItem('username', data.username)
        setAuthStatus({ hasUser: true, authenticated: true, username: data.username, enableAdminLogin: true })
        fetchData()
      } else setFormError(data.error || '登录失败')
    } catch (err) { setFormError('网络错误') }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { headers: { 'X-Session-Id': sessionId } })
    localStorage.removeItem('sessionId')
    localStorage.removeItem('username')
    setSessionId('')
    setUsername('')
    setAuthStatus(prev => ({ ...prev, authenticated: false }))
    setInstances([])
    setShowMenu(false)
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
    } catch (err) { alert('添加失败') }
  }

  const handleDeleteInstance = async (id: string) => {
    if (!confirm(`确定要删除实例 "${id}" 吗？`)) return
    try {
      await fetch(`/api/instances/${id}`, { method: 'DELETE', headers: { 'X-Session-Id': sessionId } })
      fetchData()
      alert('实例已删除')
    } catch (err) { alert('删除失败') }
  }

  const handleRefreshInstance = async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/status`, { headers: { 'X-Session-Id': sessionId } })
      const updated = await res.json()
      setInstances(prev => prev.map(i => i.id === id ? updated : i))
    } catch (err) { alert('刷新失败') }
  }

  const handleResolveError = async (id: string) => {
    try {
      await fetch(`/api/errors/${id}/resolve`, { method: 'POST', headers: { 'X-Session-Id': sessionId } })
      fetchData()
    } catch (err) { alert('操作失败') }
  }

  const copyError = (error: ErrorLog) => {
    const text = `【OpenClaw 错误报告】
设备：${error.instanceName} (${error.instanceId})
时间：${new Date(error.timestamp).toLocaleString('zh-CN')}
级别：${error.level.toUpperCase()}

错误信息：
${error.message}

上下文：
${error.context}`
    navigator.clipboard.writeText(text)
    alert('错误信息已复制，可以发送给 AI 分析')
  }

  useEffect(() => {
    if (authStatus.authenticated) {
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [authStatus.authenticated, sessionId])

  // 登录页面
  if (authStatus.enableAdminLogin && !authStatus.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: isDarkMode ? 'linear-gradient(180deg, #1C1C1E 0%, #2C2C2E 100%)' : 'linear-gradient(180deg, #F2F2F7 0%, #FFFFFF 100%)' }}>
        <div className="w-full max-w-md">
          <div className="glass-dark rounded-3xl p-8 shadow-glass animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold" style={{ color: isDarkMode ? '#fff' : '#1C1C1E' }}>OpenClaw 监控面板</h1>
              <p className="text-gray-400 mt-2">请使用管理员账号登录</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 ml-1">用户名</label>
                <input type="text" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} className="w-full input-ios" style={{ color: isDarkMode ? '#fff' : '#1C1C1E' }} placeholder="请输入用户名" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 ml-1">密码</label>
                <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="w-full input-ios" style={{ color: isDarkMode ? '#fff' : '#1C1C1E' }} placeholder="请输入密码" required />
              </div>
              {formError && <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{formError}</div>}
              <button type="submit" className="w-full btn-ios-primary py-3.5 rounded-xl text-white font-medium">登录</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: isDarkMode ? 'linear-gradient(180deg, #1C1C1E 0%, #2C2C2E 100%)' : 'linear-gradient(180deg, #F2F2F7 0%, #FFFFFF 100%)' }}><div className="glass-dark rounded-2xl p-8 text-center"><div className="text-4xl mb-4 animate-pulse">🦞</div><div style={{ color: isDarkMode ? '#fff' : '#1C1C1E' }}>加载中...</div></div></div>

  const onlineCount = instances.filter(i => i.status === 'online').length
  const errorCount = instances.filter(i => i.status === 'error').length
  const offlineCount = instances.filter(i => i.status === 'offline').length
  const unresolvedErrors = errorLogs.filter(e => !e.resolved).length

  return (
    <div className="min-h-screen" style={{ background: isDarkMode ? 'linear-gradient(180deg, #1C1C1E 0%, #2C2C2E 100%)' : 'linear-gradient(180deg, #F2F2F7 0%, #FFFFFF 100%)', color: isDarkMode ? '#fff' : '#1C1C1E' }}>
      {/* 导航栏 */}
      <header className="nav-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🦞</div>
              <div><h1 className="text-lg font-bold">OpenClaw Monitor</h1><p className="text-xs text-gray-400">集中监控面板</p></div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle" title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}>
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              {authStatus.enableAdminLogin && (
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:bg-white/10 transition-all">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">{username.charAt(0).toUpperCase()}</div>
                    <span className="text-sm font-medium hidden sm:inline">{username}</span>
                    <span className={`text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {showMenu && (<>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                    <div className="absolute right-0 mt-2 w-48 dropdown-ios z-50 overflow-hidden animate-fade-in">
                      <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors">退出登录</button>
                    </div>
                  </>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 标签页 */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="glass rounded-xl p-1.5 inline-flex gap-1">
          <button onClick={() => setActiveTab('overview')} className={`tab-ios text-sm font-medium ${activeTab === 'overview' ? 'tab-ios-active' : ''}`}>📊 总览</button>
          <button onClick={() => setActiveTab('instances')} className={`tab-ios text-sm font-medium ${activeTab === 'instances' ? 'tab-ios-active' : ''}`}>💻 实例</button>
          <button onClick={() => setActiveTab('errors')} className={`tab-ios text-sm font-medium ${activeTab === 'errors' ? 'tab-ios-active' : ''}`}>⚠️ 错误</button>
          <button onClick={() => setActiveTab('version')} className={`tab-ios text-sm font-medium ${activeTab === 'version' ? 'tab-ios-active' : ''}`}>📦 版本</button>
        </div>
      </div>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 总览页 */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card-ios p-5">
                <div className="text-sm text-gray-400 mb-1">在线实例</div>
                <div className="text-3xl font-bold text-green-400">{onlineCount}</div>
              </div>
              <div className="card-ios p-5">
                <div className="text-sm text-gray-400 mb-1">警告</div>
                <div className="text-3xl font-bold text-orange-400">{errorCount}</div>
              </div>
              <div className="card-ios p-5">
                <div className="text-sm text-gray-400 mb-1">离线</div>
                <div className="text-3xl font-bold text-red-400">{offlineCount}</div>
              </div>
              <div className="card-ios p-5">
                <div className="text-sm text-gray-400 mb-1">未解决错误</div>
                <div className="text-3xl font-bold text-red-400">{unresolvedErrors}</div>
              </div>
            </div>

            {/* 实例列表 */}
            {instances.length === 0 ? (
              <div className="card-ios p-12 text-center">
                <div className="text-7xl mb-6">🌍</div>
                <h3 className="text-2xl font-bold mb-3">暂无监控实例</h3>
                <p className="text-gray-400 mb-8">添加您的 OpenClaw 实例，开始集中监控</p>
                <button onClick={() => { setActiveTab('instances'); setShowAddForm(true) }} className="btn-ios-primary px-8 py-3.5 rounded-xl text-white font-medium">添加第一个实例</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="card-ios p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-lg">{instance.name || instance.id}</h4>
                        <p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p>
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${instance.status === 'online' ? 'bg-green-500/20 text-green-400' : instance.status === 'error' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                        {instance.status === 'online' ? '● 在线' : instance.status === 'error' ? '● 警告' : '● 离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-3 break-all bg-black/20 rounded-lg p-2">{instance.url}</p>
                    {instance.error && <p className="text-xs text-red-400 mb-3 bg-red-500/10 rounded-lg p-2">{instance.error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleRefreshInstance(instance.id)} className="flex-1 px-3 py-2 btn-ios text-xs">刷新</button>
                      <button onClick={() => handleDeleteInstance(instance.id)} className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-xs text-red-400">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 实例管理页 */}
        {activeTab === 'instances' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">OpenClaw 实例</h3>
              <button onClick={() => setShowAddForm(!showAddForm)} className="btn-ios-primary px-4 py-2 rounded-xl text-sm font-medium">{showAddForm ? '取消' : '+ 添加实例'}</button>
            </div>
            {showAddForm && (
              <div className="card-ios p-6">
                <h4 className="font-semibold mb-4">添加新实例</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-400 mb-2">实例 ID *</label><input type="text" value={newInstance.id} onChange={(e) => setNewInstance({ ...newInstance, id: e.target.value })} className="w-full input-ios" placeholder="home-server" /></div>
                  <div><label className="block text-sm text-gray-400 mb-2">名称</label><input type="text" value={newInstance.name} onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })} className="w-full input-ios" placeholder="家里服务器" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-2">WebSocket 地址 *</label><input type="text" value={newInstance.url} onChange={(e) => setNewInstance({ ...newInstance, url: e.target.value })} className="w-full input-ios" placeholder="ws://192.168.1.100:18789" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-2">Gateway Token（可选）</label><input type="text" value={newInstance.token} onChange={(e) => setNewInstance({ ...newInstance, token: e.target.value })} className="w-full input-ios" placeholder="配置了认证则填写" /></div>
                </div>
                <button onClick={handleAddInstance} className="mt-4 px-6 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-medium">确认添加</button>
              </div>
            )}
            {instances.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="card-ios p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div><h4 className="font-semibold text-lg">{instance.name || instance.id}</h4><p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p></div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${instance.status === 'online' ? 'bg-green-500/20 text-green-400' : instance.status === 'error' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                        {instance.status === 'online' ? '● 在线' : instance.status === 'error' ? '● 警告' : '● 离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-3 break-all bg-black/20 rounded-lg p-2">{instance.url}</p>
                    {instance.error && <p className="text-xs text-red-400 mb-3 bg-red-500/10 rounded-lg p-2">{instance.error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleRefreshInstance(instance.id)} className="flex-1 px-3 py-2 btn-ios text-xs">刷新</button>
                      <button onClick={() => handleDeleteInstance(instance.id)} className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl text-xs text-red-400">删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 错误中心页 */}
        {activeTab === 'errors' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">错误日志中心</h3>
              <span className="text-sm text-gray-400">{unresolvedErrors} 个未解决</span>
            </div>
            {errorLogs.length === 0 ? (
              <div className="card-ios p-12 text-center">
                <div className="text-7xl mb-6">✅</div>
                <h3 className="text-2xl font-bold mb-3">没有错误记录</h3>
                <p className="text-gray-400">一切正常！</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errorLogs.map((error) => (
                  <div key={error.id} className={`card-ios p-5 ${error.resolved ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl ${error.level === 'error' ? '🔴' : error.level === 'warning' ? '🟡' : '🔵'}`}></span>
                        <div>
                          <h4 className="font-semibold">{error.instanceName}</h4>
                          <p className="text-xs text-gray-400">{new Date(error.timestamp).toLocaleString('zh-CN')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!error.resolved && (
                          <button onClick={() => handleResolveError(error.id)} className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-xs text-green-400">标记解决</button>
                        )}
                        <button onClick={() => copyError(error)} className="px-3 py-1.5 btn-ios text-xs">复制给 AI</button>
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3 mb-3">
                      <p className="text-sm font-medium mb-1">{error.message}</p>
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap">{error.context}</pre>
                    </div>
                    {error.resolved && <span className="text-xs text-green-400">✅ 已解决</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 版本管理页 */}
        {activeTab === 'version' && versionInfo && (
          <div className="space-y-4">
            <div className="card-ios p-6">
              <h3 className="text-lg font-bold mb-4">版本信息</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-white/10"><span className="text-gray-400">当前版本</span><span className="font-mono">{versionInfo.current}</span></div>
                {versionInfo.latest && (<>
                  <div className="flex justify-between py-2 border-b border-white/10"><span className="text-gray-400">最新版本</span><span className="font-mono">{versionInfo.latest.version}</span></div>
                  <div className="flex justify-between py-2"><span className="text-gray-400">更新可用</span><span className={versionInfo.updateAvailable ? 'text-green-400' : 'text-gray-400'}>{versionInfo.updateAvailable ? '✅ 是' : '❌ 否'}</span></div>
                </>)}
              </div>
            </div>
            {versionInfo.latest?.body && (
              <div className="card-ios p-6">
                <h3 className="text-lg font-bold mb-4">更新日志</h3>
                <pre className="whitespace-pre-wrap text-sm bg-black/20 rounded-xl p-4">{versionInfo.latest.body}</pre>
              </div>
            )}
            {versionInfo.latest?.url && (
              <a href={versionInfo.latest.url} target="_blank" rel="noopener noreferrer" className="btn-ios-primary px-6 py-3 rounded-xl text-white font-medium inline-block">查看 GitHub Release</a>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 mt-12 py-6 text-center"><p className="text-gray-500 text-sm">OpenClaw Monitor · 每 30 秒自动刷新</p></footer>
    </div>
  )
}

export default App

import { useState, useEffect } from 'react'

interface RemoteInstance { id: string; name: string; url: string; status: 'online' | 'offline' | 'error'; error?: string; lastSeen?: number; }
interface VersionInfo { current: string; latest: { version: string; publishedAt: string; body: string; url: string } | null; updateAvailable: boolean; }
interface OfficialLinks { github: string; releases: string; docs: string; discord: string; clawhub: string; }
interface NewInstanceForm { id: string; name: string; url: string; token: string; }

function App() {
  const [authStatus, setAuthStatus] = useState<{ hasUser: boolean; authenticated: boolean; username?: string }>({ hasUser: false, authenticated: false })
  const [loading, setLoading] = useState(true)
  const [isRegister, setIsRegister] = useState(true)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [formError, setFormError] = useState('')
  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem('sessionId') || '')
  const [username, setUsername] = useState<string>(() => localStorage.getItem('username') || '')
  const [showMenu, setShowMenu] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmNew: '' })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [instances, setInstances] = useState<RemoteInstance[]>([])
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [officialLinks, setOfficialLinks] = useState<OfficialLinks | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'instances' | 'logs' | 'update' | 'links'>('overview')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newInstance, setNewInstance] = useState<NewInstanceForm>({ id: '', name: '', url: '', token: '' })

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status', { headers: sessionId ? { 'X-Session-Id': sessionId } : {} })
      const data = await res.json()
      setAuthStatus(data)
      if (data.authenticated && sessionId) fetchData()
      setLoading(false)
    } catch (err) { setLoading(false) }
  }

  const fetchData = async () => {
    if (!sessionId) return
    const headers = { 'X-Session-Id': sessionId }
    try {
      const [instancesRes, versionRes, logsRes, linksRes] = await Promise.all([
        fetch('/api/instances', { headers }), fetch('/api/version/latest', { headers }), fetch('/api/logs', { headers }), fetch('/api/links', { headers })
      ])
      setInstances(await instancesRes.json())
      setVersionInfo(await versionRes.json())
      setLogs((await logsRes.json()).logs)
      setOfficialLinks(await linksRes.json())
    } catch (err) { console.error('Failed to fetch data:', err) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (registerForm.password !== registerForm.confirmPassword) { setFormError('两次输入的密码不一致'); return }
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: registerForm.username, password: registerForm.password }) })
      const data = await res.json()
      if (res.ok) { setSessionId(data.sessionId); setUsername(data.username); localStorage.setItem('sessionId', data.sessionId); localStorage.setItem('username', data.username); setAuthStatus({ hasUser: true, authenticated: true, username: data.username }); fetchData() }
      else { setFormError(data.error || '注册失败') }
    } catch (err) { setFormError('网络错误') }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) })
      const data = await res.json()
      if (res.ok) { setSessionId(data.sessionId); setUsername(data.username); localStorage.setItem('sessionId', data.sessionId); localStorage.setItem('username', data.username); setAuthStatus({ hasUser: true, authenticated: true, username: data.username }); fetchData() }
      else { setFormError(data.error || '登录失败') }
    } catch (err) { setFormError('网络错误') }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { headers: { 'X-Session-Id': sessionId } })
    localStorage.removeItem('sessionId'); localStorage.removeItem('username')
    setSessionId(''); setUsername('')
    setAuthStatus(prev => ({ ...prev, authenticated: false })); setInstances([]); setShowMenu(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmNew) { alert('两次输入的新密码不一致'); return }
    if (passwordForm.newPassword.length < 6) { alert('新密码至少 6 个字符'); return }
    try {
      const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId }, body: JSON.stringify({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword }) })
      if (res.ok) { alert('密码修改成功，请重新登录'); setShowPasswordModal(false); handleLogout() }
      else { const data = await res.json(); alert(data.error || '修改失败') }
    } catch (err) { alert('网络错误') }
  }

  const handleAddInstance = async () => {
    if (!newInstance.id || !newInstance.url) { alert('ID 和 WebSocket 地址是必填项'); return }
    try {
      await fetch('/api/instances', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId }, body: JSON.stringify(newInstance) })
      setNewInstance({ id: '', name: '', url: '', token: '' }); setShowAddForm(false); fetchData(); alert('实例添加成功')
    } catch (err) { alert('添加失败') }
  }

  const handleDeleteInstance = async (id: string) => {
    if (!confirm(`确定要删除实例 "${id}" 吗？`)) return
    try { await fetch(`/api/instances/${id}`, { method: 'DELETE', headers: { 'X-Session-Id': sessionId } }); fetchData(); alert('实例已删除') }
    catch (err) { alert('删除失败') }
  }

  const handleRefreshInstance = async (id: string) => {
    try {
      const res = await fetch(`/api/instances/${id}/status`, { headers: { 'X-Session-Id': sessionId } })
      const updated = await res.json()
      setInstances(prev => prev.map(i => i.id === id ? updated : i))
    } catch (err) { alert('刷新失败') }
  }

  const copyLogs = () => { navigator.clipboard.writeText(logs); alert('日志已复制') }

  useEffect(() => { if (authStatus.authenticated) { const interval = setInterval(fetchData, 30000); return () => clearInterval(interval) } }, [authStatus.authenticated, sessionId])

  if (!authStatus.authenticated) {
    return (
      <div className="min-h-screen ios-gradient-dark flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="w-full max-w-md relative z-10">
          <div className="glass-dark rounded-3xl p-8 shadow-glass animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl glass flex items-center justify-center text-4xl">🦞</div>
              <h1 className="text-2xl font-bold text-white">OpenClaw 监控面板</h1>
              <p className="text-gray-400 mt-2">{authStatus.hasUser ? '欢迎回来' : '首次使用请注册'}</p>
            </div>
            {authStatus.hasUser && (
              <div className="flex mb-6 p-1 glass rounded-xl">
                <button onClick={() => setIsRegister(false)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${!isRegister ? 'bg-ios-blue text-white shadow-ios' : 'text-gray-400 hover:text-white'}`}>登录</button>
                <button onClick={() => setIsRegister(true)} className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${isRegister ? 'bg-ios-blue text-white shadow-ios' : 'text-gray-400 hover:text-white'}`}>注册</button>
              </div>
            )}
            <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-2 ml-1">用户名</label><input type="text" value={isRegister ? registerForm.username : loginForm.username} onChange={(e) => isRegister ? setRegisterForm({ ...registerForm, username: e.target.value }) : setLoginForm({ ...loginForm, username: e.target.value })} className="w-full input-ios text-white" placeholder="至少 3 个字符" minLength={3} required /></div>
              <div><label className="block text-sm text-gray-400 mb-2 ml-1">密码</label><input type="password" value={isRegister ? registerForm.password : loginForm.password} onChange={(e) => isRegister ? setRegisterForm({ ...registerForm, password: e.target.value }) : setLoginForm({ ...loginForm, password: e.target.value })} className="w-full input-ios text-white" placeholder="至少 6 个字符" minLength={6} required /></div>
              {isRegister && <div><label className="block text-sm text-gray-400 mb-2 ml-1">确认密码</label><input type="password" value={registerForm.confirmPassword} onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} className="w-full input-ios text-white" placeholder="再次输入密码" required /></div>}
              {formError && <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">{formError}</div>}
              <button type="submit" className="w-full btn-ios-primary py-3.5 rounded-xl text-white font-medium text-base shadow-lg hover:shadow-xl transition-all">{isRegister ? '注册并登录' : '登录'}</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen ios-gradient-dark flex items-center justify-center"><div className="glass-dark rounded-2xl p-8 text-center"><div className="text-4xl mb-4 animate-pulse">🦞</div><div className="text-white text-lg">加载中...</div></div></div>

  return (
    <div className="min-h-screen ios-gradient-dark">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>
      <header className="nav-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-2xl">🦞</div>
              <div><h1 className="text-lg font-bold text-white">OpenClaw</h1><p className="text-xs text-gray-400">多实例监控</p></div>
            </div>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:bg-white/10 transition-all">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">{username.charAt(0).toUpperCase()}</div>
                <span className="text-white text-sm font-medium hidden sm:inline">{username}</span>
                <span className={`text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showMenu && (<>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                <div className="absolute right-0 mt-2 w-48 dropdown-ios z-50 overflow-hidden animate-fade-in">
                  <button onClick={() => { setShowPasswordModal(true); setShowMenu(false); }} className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3">🔑 修改密码</button>
                  <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3 border-t border-white/10">🚪 退出登录</button>
                </div>
              </>)}
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="glass rounded-xl p-1.5 inline-flex gap-1">
          {['overview', 'instances', 'logs', 'update', 'links'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`tab-ios text-sm font-medium ${activeTab === tab ? 'tab-ios-active' : 'text-gray-400 hover:text-white'}`}>
              {tab === 'overview' && '📊 概览'}{tab === 'instances' && '💻 实例'}{tab === 'logs' && '📋 日志'}{tab === 'update' && '🔄 更新'}{tab === 'links' && '🔗 官方'}
            </button>
          ))}
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 py-6 relative z-10">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {instances.length === 0 ? (
              <div className="card-ios p-12 text-center animate-fade-in">
                <div className="text-7xl mb-6">🌍</div>
                <h3 className="text-2xl font-bold text-white mb-3">暂无监控实例</h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">添加您的 OpenClaw 实例，开始集中监控</p>
                <button onClick={() => { setActiveTab('instances'); setShowAddForm(true) }} className="btn-ios-primary px-8 py-3.5 rounded-xl text-white font-medium shadow-lg hover:shadow-xl transition-all">➕ 添加第一个实例</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="card-ios p-5 animate-fade-in">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1"><h4 className="font-semibold text-lg text-white">{instance.name || instance.id}</h4><p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p></div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${instance.status === 'online' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : instance.status === 'error' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        <span className={`status-dot ${instance.status === 'online' ? 'status-dot-online' : instance.status === 'error' ? 'status-dot-error' : 'status-dot-offline'}`}></span>
                        {instance.status === 'online' ? '在线' : instance.status === 'error' ? '错误' : '离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-4 break-all bg-black/20 rounded-lg p-2.5">{instance.url}</p>
                    {instance.error && <p className="text-xs text-red-400 mb-4 bg-red-500/10 rounded-lg p-2.5 border border-red-500/20">{instance.error}</p>}
                    {instance.lastSeen && <p className="text-xs text-gray-500 mb-4">最后检查：{new Date(instance.lastSeen).toLocaleString('zh-CN')}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleRefreshInstance(instance.id)} className="flex-1 px-3 py-2.5 btn-ios text-xs font-medium text-white">🔄 刷新</button>
                      <button onClick={() => handleDeleteInstance(instance.id)} className="flex-1 px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-xs font-medium text-red-400 transition-all">🗑️ 删除</button>
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
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><span>💻</span> OpenClaw 实例</h3>
              <button onClick={() => setShowAddForm(!showAddForm)} className="btn-ios-primary px-4 py-2 rounded-xl text-sm font-medium shadow-lg">{showAddForm ? '✕ 取消' : '+ 添加实例'}</button>
            </div>
            {showAddForm && (
              <div className="card-ios p-6 animate-fade-in">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2"><span>➕</span> 添加新实例</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-400 mb-2 ml-1">实例 ID *</label><input type="text" value={newInstance.id} onChange={(e) => setNewInstance({ ...newInstance, id: e.target.value })} className="w-full input-ios text-white" placeholder="home-server" /></div>
                  <div><label className="block text-sm text-gray-400 mb-2 ml-1">名称</label><input type="text" value={newInstance.name} onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })} className="w-full input-ios text-white" placeholder="家里服务器" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-2 ml-1">WebSocket 地址 *</label><input type="text" value={newInstance.url} onChange={(e) => setNewInstance({ ...newInstance, url: e.target.value })} className="w-full input-ios text-white" placeholder="ws://192.168.1.100:18789" /></div>
                  <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-2 ml-1">Gateway Token（可选）</label><input type="text" value={newInstance.token} onChange={(e) => setNewInstance({ ...newInstance, token: e.target.value })} className="w-full input-ios text-white" placeholder="配置了认证则填写" /></div>
                </div>
                <button onClick={handleAddInstance} className="mt-4 px-6 py-2.5 bg-green-500 hover:bg-green-600 rounded-xl text-sm font-medium text-white shadow-lg transition-all">确认添加</button>
              </div>
            )}
            {instances.length === 0 && !showAddForm && (<div className="card-ios p-12 text-center"><div className="text-5xl mb-4">🌍</div><p className="text-gray-400 mb-2">暂无远程实例</p><p className="text-sm text-gray-500">点击上方按钮添加 OpenClaw 实例</p></div>)}
            {instances.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="card-ios p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div><h4 className="font-semibold text-lg text-white">{instance.name || instance.id}</h4><p className="text-xs text-gray-400 font-mono mt-1">{instance.id}</p></div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 ${instance.status === 'online' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : instance.status === 'error' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                        <span className={`status-dot ${instance.status === 'online' ? 'status-dot-online' : instance.status === 'error' ? 'status-dot-error' : 'status-dot-offline'}`}></span>
                        {instance.status === 'online' ? '在线' : instance.status === 'error' ? '错误' : '离线'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mb-4 break-all bg-black/20 rounded-lg p-2.5">{instance.url}</p>
                    {instance.error && <p className="text-xs text-red-400 mb-4 bg-red-500/10 rounded-lg p-2.5 border border-red-500/20">{instance.error}</p>}
                    {instance.lastSeen && <p className="text-xs text-gray-500 mb-4">最后检查：{new Date(instance.lastSeen).toLocaleString('zh-CN')}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => handleRefreshInstance(instance.id)} className="flex-1 px-3 py-2.5 btn-ios text-xs font-medium text-white">🔄 刷新</button>
                      <button onClick={() => handleDeleteInstance(instance.id)} className="flex-1 px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-xs font-medium text-red-400 transition-all">🗑️ 删除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="card-ios overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-medium text-white flex items-center gap-2"><span>📋</span> Gateway 日志</h3>
              <button onClick={copyLogs} className="btn-ios px-3 py-1.5 text-sm text-white">📋 复制</button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-auto max-h-[600px] bg-black/20 font-mono">{logs || '暂无日志'}</pre>
          </div>
        )}
        {activeTab === 'update' && (
          <div className="space-y-4">
            <div className="card-ios p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span>📦</span> 版本信息</h3>
              <div className="space-y-3 divide-y divide-white/10">
                <div className="flex justify-between py-2"><span className="text-gray-400">当前版本</span><span className="font-mono text-white">{versionInfo?.current}</span></div>
                {versionInfo?.latest && (<><div className="flex justify-between py-2"><span className="text-gray-400">最新版本</span><span className="font-mono text-white">{versionInfo.latest.version}</span></div><div className="flex justify-between py-2"><span className="text-gray-400">更新可用</span><span className={versionInfo.updateAvailable ? 'text-green-400' : 'text-gray-400'}>{versionInfo.updateAvailable ? '✅ 是' : '❌ 否'}</span></div></>)}
              </div>
            </div>
            {versionInfo?.latest?.body && (<div className="card-ios p-6"><h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span>📝</span> 更新日志</h3><pre className="whitespace-pre-wrap text-sm text-gray-300 bg-black/20 rounded-xl p-4 font-mono">{versionInfo.latest.body}</pre></div>)}
          </div>
        )}
        {activeTab === 'links' && officialLinks && (
          <div className="card-ios p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><span>🔗</span> 官方资源</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href={officialLinks.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-all"><span className="text-2xl">📂</span><div><p className="font-medium text-white">GitHub</p><p className="text-xs text-gray-400">源代码</p></div></a>
              <a href={officialLinks.releases} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-all"><span className="text-2xl">🏷️</span><div><p className="font-medium text-white">Releases</p><p className="text-xs text-gray-400">版本发布</p></div></a>
              <a href={officialLinks.docs} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-all"><span className="text-2xl">📖</span><div><p className="font-medium text-white">文档</p><p className="text-xs text-gray-400">使用指南</p></div></a>
              <a href={officialLinks.discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 glass rounded-xl hover:bg-white/10 transition-all"><span className="text-2xl">💬</span><div><p className="font-medium text-white">Discord</p><p className="text-xs text-gray-400">社区</p></div></a>
            </div>
          </div>
        )}
      </main>
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-ios p-6 max-w-md w-full animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">🔑 修改密码</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-2 ml-1">原密码</label><input type="password" value={passwordForm.oldPassword} onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} className="w-full input-ios text-white" required /></div>
              <div><label className="block text-sm text-gray-400 mb-2 ml-1">新密码</label><input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full input-ios text-white" minLength={6} required /></div>
              <div><label className="block text-sm text-gray-400 mb-2 ml-1">确认新密码</label><input type="password" value={passwordForm.confirmNew} onChange={(e) => setPasswordForm({ ...passwordForm, confirmNew: e.target.value })} className="w-full input-ios text-white" required /></div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-3 glass rounded-xl text-white font-medium hover:bg-white/10 transition-all">取消</button>
                <button type="submit" className="flex-1 px-4 py-3 btn-ios-primary rounded-xl text-white font-medium">确认修改</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <footer className="border-t border-white/10 mt-12 py-6 text-center"><p className="text-gray-500 text-sm">🦞 OpenClaw 监控面板</p></footer>
    </div>
  )
}

export default App

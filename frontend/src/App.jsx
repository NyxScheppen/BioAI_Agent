import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'

const IMAGE_TYPES = ['image']
const DOWNLOADABLE_TYPES = ['table', 'text', 'other', 'pdf', 'archive']

const createSession = () => {
  const id =
    window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`

  return {
    id,
    title: '新会话',
    attachedFile: null,
    messages: [
      {
        role: 'ai',
        content: '你好！我是你的 生物信息学 专属 Agent。我已经准备好处理你的实验数据了。'
      }
    ],
    results: [
      {
        id: `status_${Date.now()}`,
        type: 'text',
        title: '🧬 实验室状态',
        content: '请上传 .csv / .txt / .tsv / .xlsx 等文件开始分析。'
      }
    ]
  }
}

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('bio_agent_sessions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch (e) {}
    }
    return [createSession()]
  })

  const [currentSessionId, setCurrentSessionId] = useState(() => {
    return localStorage.getItem('bio_agent_current_session_id') || null
  })

  const [userInput, setUserInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.5)

  const isResizing = useRef(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      setCurrentSessionId(sessions[0].id)
    }
  }, [currentSessionId, sessions])

  useEffect(() => {
    localStorage.setItem('bio_agent_sessions', JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('bio_agent_current_session_id', currentSessionId)
    }
  }, [currentSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, currentSessionId, isLoading])

  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0] || null

  const startResizing = () => {
    isResizing.current = true
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', stopResizing)
    document.body.style.userSelect = 'none'
  }

  const stopResizing = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', stopResizing)
    document.body.style.userSelect = 'auto'
  }

  const handleMouseMove = (e) => {
    if (!isResizing.current) return
    if (e.clientX > 340 && e.clientX < window.innerWidth - 280) {
      setLeftWidth(e.clientX)
    }
  }

  const updateSession = (sessionId, updater) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? typeof updater === 'function'
            ? updater(session)
            : { ...session, ...updater }
          : session
      )
    )
  }

  const handleNewSession = () => {
    const newSession = createSession()
    setSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setUserInput('')
    setIsLoading(false)
  }

  const handleSelectSession = (sessionId) => {
    setCurrentSessionId(sessionId)
    setUserInput('')
  }

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation()

    const filtered = sessions.filter((s) => s.id !== sessionId)
    if (filtered.length === 0) {
      const fresh = createSession()
      setSessions([fresh])
      setCurrentSessionId(fresh.id)
      return
    }

    setSessions(filtered)
    if (currentSessionId === sessionId) {
      setCurrentSessionId(filtered[0].id)
    }
  }

  const normalizeToAbsoluteFileUrl = (url) => {
    if (!url) return ''

    let finalUrl = String(url).trim()

    if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
      return finalUrl.replace('/workspace/', '/files/')
    }

    if (finalUrl.startsWith('/files/')) {
      return `${API_BASE}${finalUrl}`
    }

    if (finalUrl.startsWith('generated/')) {
      return `${API_BASE}/files/${finalUrl}`
    }

    if (finalUrl.startsWith('files/')) {
      return `${API_BASE}/${finalUrl}`
    }

    finalUrl = finalUrl.replace(/^\/+/, '')
    return `${API_BASE}/files/${finalUrl}`
  }

  const guessResultType = (file) => {
    if (!file) return 'file'
    if (file.type === 'image') return 'plot'
    return 'file'
  }

  const buildResultFromFile = (file) => {
    const absoluteUrl = normalizeToAbsoluteFileUrl(file.url || file.relative_path || file.name)

    return {
      id: `${file.relative_path || file.name}_${Date.now()}_${Math.random()}`,
      type: guessResultType(file),
      fileType: file.type || 'other',
      title: file.type === 'image' ? '📊 生物信息分析图表' : `📎 ${file.name}`,
      content: file.type === 'image' ? `${absoluteUrl}?t=${Date.now()}` : absoluteUrl,
      rawUrl: absoluteUrl,
      filename: file.name || 'download',
      relativePath: file.relative_path || ''
    }
  }

  const mergeSessionResults = (session, incomingResults) => {
    const prevResults = session.results || []

    const existingKeys = new Set(
      prevResults.map((item) =>
        item.type === 'plot'
          ? `${item.filename || ''}|${(item.content || '').split('?')[0]}`
          : `${item.filename || ''}|${item.rawUrl || item.content || ''}`
      )
    )

    const uniqueNew = incomingResults.filter((item) => {
      const key =
        item.type === 'plot'
          ? `${item.filename || ''}|${(item.content || '').split('?')[0]}`
          : `${item.filename || ''}|${item.rawUrl || item.content || ''}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    return [...uniqueNew, ...prevResults]
  }

  const updateWorkbench = (sessionId, aiReply, backendFiles = []) => {
    const markdownImgRegex = /!\[.*?\]\((.*?)\)/g
    const plainUrlRegex =
      /http:\/\/127\.0\.0\.1:8000\/files\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|svg|gif|webp)/gi
    const markdownLinkRegex = /\[([^\]]+)\]\((.*?)\)/g

    const imageUrls = new Set()
    const fileLinks = new Map()
    const newResults = []

    let match
    while ((match = markdownImgRegex.exec(aiReply)) !== null) {
      if (match[1]) imageUrls.add(match[1])
    }

    let urlMatch
    while ((urlMatch = plainUrlRegex.exec(aiReply)) !== null) {
      imageUrls.add(urlMatch[0])
    }

    let linkMatch
    while ((linkMatch = markdownLinkRegex.exec(aiReply)) !== null) {
      const text = linkMatch[1]
      const url = linkMatch[2]
      if (!url) continue

      const lower = url.toLowerCase()
      const isImage = /\.(png|jpg|jpeg|svg|gif|webp)(\?|$)/i.test(lower)

      if (isImage) {
        imageUrls.add(url)
      } else {
        const abs = normalizeToAbsoluteFileUrl(url)
        fileLinks.set(abs, {
          id: `md_${abs}_${Date.now()}_${Math.random()}`,
          type: 'file',
          fileType: 'other',
          title: `📎 ${text || '结果文件'}`,
          content: abs,
          rawUrl: abs,
          filename: text || abs.split('/').pop() || 'download'
        })
      }
    }

    imageUrls.forEach((url) => {
      const finalUrl = normalizeToAbsoluteFileUrl(url)
      if (!finalUrl) return

      newResults.push({
        id: `img_${finalUrl}_${Date.now()}_${Math.random()}`,
        type: 'plot',
        fileType: 'image',
        title: '📊 生物信息分析图表',
        content: `${finalUrl}?t=${Date.now()}`,
        rawUrl: finalUrl,
        filename: finalUrl.split('/').pop() || 'plot.png'
      })
    })

    fileLinks.forEach((item) => newResults.push(item))

    if (Array.isArray(backendFiles)) {
      backendFiles.forEach((file) => {
        newResults.push(buildResultFromFile(file))
      })
    }

    if (newResults.length === 0) return

    updateSession(sessionId, (session) => ({
      ...session,
      results: mergeSessionResults(session, newResults)
    }))
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file || !currentSession) return

    setIsLoading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('session_id', currentSession.id)

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        updateSession(currentSession.id, (session) => ({
          ...session,
          attachedFile: data.filename || file.name,
          title:
            session.title === '新会话'
              ? data.filename || file.name
              : session.title
        }))
      } else {
        alert(data.detail || '文件上传失败')
      }
    } catch (error) {
      alert('文件上传失败')
    } finally {
      setIsLoading(false)
      event.target.value = ''
    }
  }

  const sendMessage = async () => {
    if (!currentSession) return
    if (!userInput.trim() && !currentSession.attachedFile) return
    if (isLoading) return

    const displayContent = currentSession.attachedFile
      ? `发送的文件：[文件:${currentSession.attachedFile}] ${userInput}`
      : userInput

    const newMessage = { role: 'user', content: displayContent }
    const updatedHistory = [...currentSession.messages, newMessage]

    updateSession(currentSession.id, {
      messages: updatedHistory,
      attachedFile: null
    })

    setUserInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.id,
          messages: updatedHistory
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || '请求失败')
      }

      updateSession(currentSession.id, (session) => ({
        ...session,
        title: data.title || session.title,
        messages: [
          ...session.messages,
          { role: 'ai', content: data.reply || '分析完成。' }
        ]
      }))

      updateWorkbench(currentSession.id, data.reply || '', data.files || [])
    } catch (error) {
      updateSession(currentSession.id, (session) => ({
        ...session,
        messages: [
          ...session.messages,
          { role: 'ai', content: '❌ 后端连接异常' }
        ]
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const renderResultCard = (res, index) => {
    if (res.type === 'plot') {
      return (
        <div key={res.id || index} className="result-card">
          <h3>{res.title}</h3>
          <div className="result-content">
            <img src={res.content} alt={res.filename || 'Analysis Plot'} />
            <div style={{ marginTop: '10px' }}>
              <a
                href={res.rawUrl || res.content}
                target="_blank"
                rel="noreferrer"
                download={res.filename || true}
              >
                下载图片
              </a>
            </div>
          </div>
        </div>
      )
    }

    if (res.type === 'file') {
      return (
        <div key={res.id || index} className="result-card">
          <h3>{res.title}</h3>
          <div className="result-content">
            <p style={{ marginBottom: '10px', wordBreak: 'break-all' }}>
              文件名：{res.filename || '未命名文件'}
            </p>
            <a
              href={res.rawUrl || res.content}
              target="_blank"
              rel="noreferrer"
              download={res.filename || true}
              style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#72bf44',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              下载文件
            </a>
          </div>
        </div>
      )
    }

    return (
      <div key={res.id || index} className="result-card">
        <h3>{res.title}</h3>
        <div className="result-content">
          <p>{res.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="app-container"
      style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}
    >
      {/* 左侧会话栏 */}
      <div
        style={{
          width: '260px',
          background: '#111827',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={handleNewSession}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: 'none',
              background: '#72bf44',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ＋ 新会话
          </button>
        </div>

        <div style={{ padding: '12px', fontSize: '12px', color: '#9ca3af' }}>
          历史会话
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              style={{
                marginBottom: '8px',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                background:
                  session.id === currentSessionId
                    ? 'rgba(114,191,68,0.18)'
                    : 'rgba(255,255,255,0.04)',
                border:
                  session.id === currentSessionId
                    ? '1px solid rgba(114,191,68,0.45)'
                    : '1px solid transparent'
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  marginBottom: '6px'
                }}
              >
                {session.title || '新会话'}
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: '#9ca3af',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{session.messages?.length || 0} 条消息</span>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  style={{
                    background: 'transparent',
                    color: '#9ca3af',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 中间聊天区 */}
      <div className="chat-section" style={{ width: leftWidth }}>
        <div className="chat-card" style={{ height: '100%' }}>
          <div className="chat-header">
            <div
              style={{
                fontSize: '24px',
                background: '#e8f5e9',
                padding: '8px',
                borderRadius: '12px'
              }}
            >
              🧬
            </div>
            <div className="header-info">
              <h2>{currentSession?.title || '生物信息学 Agent Hub'}</h2>
              <p>● ONLINE</p>
            </div>
          </div>

          <div className="chat-window">
            {(currentSession?.messages || []).map((msg, index) => (
              <div key={index} className={`message-wrapper ${msg.role}`}>
                <div className={`message-bubble ${msg.role}`}>
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={normalizeToAbsoluteFileUrl(href)}
                          target="_blank"
                          rel="noreferrer"
                          download
                        >
                          {children}
                        </a>
                      ),
                      img: ({ src, alt }) => (
                        <img
                          src={normalizeToAbsoluteFileUrl(src)}
                          alt={alt || 'result'}
                          style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '8px' }}
                        />
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-wrapper ai">
                <div className="message-bubble ai thinking-bubble">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span style={{ color: '#72bf44', fontWeight: 'bold', marginLeft: '10px' }}>
                    正在分析...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            {currentSession?.attachedFile && (
              <div className="file-ready">📄 待处理: {currentSession.attachedFile}</div>
            )}

            <div className="input-container">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              <button
                className="N-btn"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                N
              </button>

              <input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="键入生信分析指令..."
              />

              <button onClick={sendMessage} className="send-btn">
                发送
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="resizer" onMouseDown={startResizing} />

      {/* 右侧工作台 */}
      <div className="workbench-section">
        <div className="workbench-header">
          <span className="lab-tag">LAB</span>
          <h3>Analysis Workbench</h3>
        </div>

        {(currentSession?.results || []).map((res, index) => renderResultCard(res, index))}
      </div>
    </div>
  )
}

export default App
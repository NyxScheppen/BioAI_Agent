import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000'

const DEFAULT_WELCOME_MESSAGE = {
  role: 'ai',
  content: '你好！我是你的 生物信息学 专属 Agent。我已经准备好处理你的实验数据了。'
}

const DEFAULT_RESULT_CARD = {
  type: 'text',
  title: '🧬 实验室状态',
  content: '请在左侧上传 .csv / .txt / .gz 等文件开始分析。'
}

function App() {
  const [userInput, setUserInput] = useState('')
  const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE])
  const [results, setResults] = useState([DEFAULT_RESULT_CARD])
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)

  // 当前会话 id
  const [sessionId, setSessionId] = useState('')

  // 所有会话列表
  const [sessionList, setSessionList] = useState([])

  // 默认聊天区宽度
  const [leftWidth, setLeftWidth] = useState(window.innerWidth * 0.55)

  const isResizing = useRef(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // 初始化 session_id
  useEffect(() => {
    let savedSessionId = localStorage.getItem('bio_agent_session_id')
    if (!savedSessionId) {
      savedSessionId = window.crypto?.randomUUID?.() || `session_${Date.now()}`
      localStorage.setItem('bio_agent_session_id', savedSessionId)
    }
    setSessionId(savedSessionId)
  }, [])

  // 初始化后拉当前会话历史 + 全部会话列表
  useEffect(() => {
    if (!sessionId) return
    loadHistory(sessionId)
    loadSessionList()
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

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
    if (e.clientX > 420 && e.clientX < window.innerWidth - 320) {
      setLeftWidth(e.clientX)
    }
  }

  const getFileTypeLabel = (fileType) => {
    switch (fileType) {
      case 'image':
        return '图片'
      case 'table':
        return '表格'
      case 'text':
        return '文本'
      default:
        return '文件'
    }
  }

  const mapBackendFilesToWorkbench = (backendFiles) => {
    return backendFiles.map(file => ({
      type: file.type === 'image' ? 'image' : 'file',
      fileType: file.type,
      title: `📁 ${file.name}`,
      name: file.name,
      content: `${file.url}${file.url.includes('?') ? '&' : '?'}t=${Date.now()}`
    }))
  }

  const updateWorkbench = (backendFiles) => {
    if (!backendFiles || backendFiles.length === 0) return

    const newItems = mapBackendFilesToWorkbench(backendFiles)

    setResults(prev => {
      const existingUrls = prev.map(item => (item.content || '').split('?')[0])

      const uniqueNew = newItems.filter(item => {
        const cleanUrl = item.content.split('?')[0]
        return !existingUrls.includes(cleanUrl)
      })

      const textCards = prev.filter(item => item.type === 'text')
      const nonTextCards = prev.filter(item => item.type !== 'text')

      return [...uniqueNew, ...nonTextCards, ...textCards]
    })
  }

  const loadSessionList = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history`)
      const data = await response.json()

      if (!response.ok) return

      setSessionList(Array.isArray(data) ? data : [])
    } catch (error) {
      console.warn('加载会话列表失败:', error)
    }
  }

  const loadHistory = async (sid) => {
    try {
      const response = await fetch(`${API_BASE}/api/history/${sid}`)
      const data = await response.json()

      if (!response.ok) {
        setMessages([DEFAULT_WELCOME_MESSAGE])
        setResults([DEFAULT_RESULT_CARD])
        return
      }

      // 恢复历史消息
      if (data.messages && data.messages.length > 0) {
        const restoredMessages = data.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'ai' : msg.role,
          content: msg.content
        }))
        setMessages(restoredMessages)
      } else {
        setMessages([DEFAULT_WELCOME_MESSAGE])
      }

      // 恢复历史文件到 workbench
      if (data.files && data.files.length > 0) {
        const historyFiles = data.files.map(file => ({
          url: `${API_BASE}/files/${file.relative_path}`,
          name: file.filename,
          type: file.file_type
        }))

        const mapped = mapBackendFilesToWorkbench(historyFiles)
        setResults([
          ...mapped,
          {
            type: 'text',
            title: '🧬 实验室状态',
            content: `已加载会话 ${sid.slice(0, 12)}... 的历史结果。`
          }
        ])
      } else {
        setResults([
          {
            type: 'text',
            title: '🧬 实验室状态',
            content: '该会话暂无历史文件输出。'
          }
        ])
      }
    } catch (error) {
      console.warn('加载历史记录失败:', error)
      setMessages([DEFAULT_WELCOME_MESSAGE])
      setResults([DEFAULT_RESULT_CARD])
    }
  }

  const createNewSession = async () => {
    const newSessionId = window.crypto?.randomUUID?.() || `session_${Date.now()}`
    localStorage.setItem('bio_agent_session_id', newSessionId)
    setSessionId(newSessionId)

    setMessages([DEFAULT_WELCOME_MESSAGE])

    setResults([
      {
        type: 'text',
        title: '🧬 实验室状态',
        content: '新会话已创建，请上传文件或输入分析指令。'
      }
    ])

    setUserInput('')
    setAttachedFile(null)

    // 先把新会话显示在顶部（即便后端暂时还没创建）
    setSessionList(prev => {
      const exists = prev.some(item => item.session_id === newSessionId)
      if (exists) return prev

      return [
        {
          session_id: newSessionId,
          title: '新会话',
          created_at: new Date().toISOString()
        },
        ...prev
      ]
    })
  }

  const switchSession = async (sid) => {
    if (!sid || sid === sessionId) return
    localStorage.setItem('bio_agent_session_id', sid)
    setSessionId(sid)
    setAttachedFile(null)
    setUserInput('')
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file || !sessionId) return

    setIsLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(
        `${API_BASE}/api/upload?session_id=${encodeURIComponent(sessionId)}`,
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (response.ok) {
        setAttachedFile(data.filename)

        if (data.url && data.filename) {
          updateWorkbench([
            {
              url: data.url,
              name: data.filename,
              type: data.type || 'other'
            }
          ])
        }

        loadSessionList()
      } else {
        alert('文件上传失败')
      }
    } catch (error) {
      alert('文件上传失败')
    } finally {
      setIsLoading(false)
      event.target.value = ''
    }
  }

  const sendMessage = async () => {
    if (!userInput.trim() && !attachedFile) return
    if (isLoading || !sessionId) return

    const displayContent = attachedFile
      ? `发送的文件：[文件:${attachedFile}] ${userInput}`
      : userInput

    const newMessage = { role: 'user', content: displayContent }
    const updatedHistory = [...messages, newMessage]

    setMessages(updatedHistory)
    setUserInput('')
    setAttachedFile(null)
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: updatedHistory
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'ai', content: data.reply || '分析完成，但未返回内容。' }
        ])

        if (data.files) {
          updateWorkbench(data.files)
        }

        // 聊天完成后刷新会话列表
        await loadSessionList()
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: '❌ 后端返回异常' }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: '❌ 后端连接异常' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="app-container"
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#f6f8fb'
      }}
    >
      {/* 会话侧边栏 */}
      <div
        style={{
          width: '260px',
          minWidth: '260px',
          borderRight: '1px solid #e5e7eb',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #eef2f7',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#1f2937' }}>
            会话列表
          </div>

          <button
            onClick={createNewSession}
            style={{
              border: 'none',
              background: '#72bf44',
              color: '#fff',
              borderRadius: '10px',
              padding: '10px 12px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            + 新建会话
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px'
          }}
        >
          {sessionList.length === 0 ? (
            <div style={{ color: '#888', fontSize: '14px' }}>暂无历史会话</div>
          ) : (
            sessionList.map((item) => {
              const active = item.session_id === sessionId
              return (
                <div
                  key={item.session_id}
                  onClick={() => switchSession(item.session_id)}
                  style={{
                    padding: '12px',
                    marginBottom: '10px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: active ? '1px solid #72bf44' : '1px solid #e5e7eb',
                    background: active ? '#f3faed' : '#fff',
                    boxShadow: active
                      ? '0 2px 8px rgba(114,191,68,0.12)'
                      : '0 1px 4px rgba(0,0,0,0.04)'
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: '#1f2937',
                      marginBottom: '6px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {item.title || '新会话'}
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      wordBreak: 'break-all',
                      marginBottom: '4px'
                    }}
                  >
                    {item.session_id}
                  </div>

                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {item.created_at ? String(item.created_at) : ''}
                  </div>
                </div>
              )
            })
          )}
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
              <h2>生物信息学 Agent Hub</h2>
              <p>● ONLINE</p>
              <small style={{ color: '#666' }}>
                Session: {sessionId ? sessionId.slice(0, 12) + '...' : '初始化中...'}
              </small>
            </div>
          </div>

          <div className="chat-window">
            {messages.map((msg, index) => (
              <div key={index} className={`message-wrapper ${msg.role}`}>
                <div className={`message-bubble ${msg.role}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message-wrapper ai">
                <div className="message-bubble ai thinking-bubble">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span
                    style={{
                      color: '#72bf44',
                      fontWeight: 'bold',
                      marginLeft: '10px'
                    }}
                  >
                    正在分析...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            {attachedFile && (
              <div className="file-ready">
                📄 待处理: {attachedFile}
              </div>
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
                onClick={() => fileInputRef.current?.click()}
                title="上传文件"
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

      {/* 拖拽分隔条 */}
      <div className="resizer" onMouseDown={startResizing} />

      {/* 右侧工作台 */}
      <div className="workbench-section">
        <div className="workbench-header">
          <span className="lab-tag">LAB</span>
          <h3>Analysis Workbench</h3>
        </div>

        {results.map((res, index) => (
          <div key={index} className="result-card">
            <h3>{res.title}</h3>
            <div className="result-content">
              {res.type === 'image' ? (
                <div>
                  <img src={res.content} alt={res.name || 'Analysis Plot'} />
                  <div style={{ marginTop: '10px' }}>
                    <a
                      href={res.content}
                      download={res.name}
                      target="_blank"
                      rel="noreferrer"
                    >
                      下载 {res.name || '图片'}
                    </a>
                  </div>
                </div>
              ) : res.type === 'file' ? (
                <div className="file-card">
                  <p><strong>文件名：</strong>{res.name}</p>
                  <p><strong>文件类型：</strong>{getFileTypeLabel(res.fileType)}</p>
                  <a
                    href={res.content}
                    download={res.name}
                    target="_blank"
                    rel="noreferrer"
                  >
                    点击下载
                  </a>
                </div>
              ) : (
                <p>{res.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App